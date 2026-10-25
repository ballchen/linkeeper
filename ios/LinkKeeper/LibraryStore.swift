import LinkKeeperKit
import SwiftUI

enum SourceFilter: String, CaseIterable, Identifiable {
    case all, youtube, instagram, threads, facebook, other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "全部"
        case .other: "其他"
        default: LinkSource(rawValue: rawValue)?.displayName ?? rawValue
        }
    }

    /// server 的 source 參數
    var query: String? { self == .all ? nil : rawValue }
}

struct LinkSection: Identifiable {
    let id: Date
    let title: String
    let items: [LinkItem]
}

@MainActor
@Observable
final class LibraryStore {
    private(set) var items: [LinkItem] = []
    private(set) var pendingShares: [PendingShare] = []
    private(set) var isLoading = false
    private(set) var hasLoaded = false
    private(set) var nextCursor: String?
    var errorMessage: String?

    var search = "" {
        didSet { if search != oldValue { scheduleSearch() } }
    }
    var filter: SourceFilter = .all {
        didSet { if filter != oldValue { Task { await reload() } } }
    }

    /// 刪除後可以復原的那一筆；倒數結束才真的送 DELETE
    private(set) var pendingDeletion: LinkItem?
    var onUnauthorized: (() -> Void)?

    private let api = APIClient.shared
    private let store = SharedStore.shared
    private var searchTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    private var deletionTask: Task<Void, Never>?
    private var deletionIndex = 0
    private var loadGeneration = 0

    var isFiltering: Bool { !search.isEmpty || filter != .all }

    var sections: [LinkSection] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: items) { calendar.startOfDay(for: $0.createdAt) }
        return grouped.keys.sorted(by: >).map { day in
            LinkSection(id: day, title: Self.sectionTitle(for: day), items: grouped[day] ?? [])
        }
    }

    private static func sectionTitle(for day: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(day) { return "今天" }
        if calendar.isDateInYesterday(day) { return "昨天" }
        if calendar.isDate(day, equalTo: .now, toGranularity: .year) {
            return day.formatted(.dateTime.month().day().weekday(.abbreviated))
        }
        return day.formatted(.dateTime.year().month().day())
    }

    // MARK: 讀取

    /// 先補送佇列，再重新讀第一頁
    func refresh() async {
        let drained = await UploadQueue.shared.drain()
        pendingShares = store.pendingShares()
        if drained.needsSignIn {
            onUnauthorized?()
            return
        }
        await reload()
    }

    func reload() async {
        loadGeneration += 1
        let generation = loadGeneration
        isLoading = true
        defer { if generation == loadGeneration { isLoading = false } }

        do {
            let page = try await api.listLinks(search: search, source: filter.query)
            guard generation == loadGeneration else { return }
            items = page.items.filter { $0.id != pendingDeletion?.id }
            nextCursor = page.nextCursor
            hasLoaded = true
            errorMessage = nil
            store.mergeKnownTags(items.flatMap(\.tags).uniqued())
            pollWhilePending()
        } catch {
            guard generation == loadGeneration else { return }
            handle(error)
        }
    }

    func loadMoreIfNeeded(after item: LinkItem) async {
        guard let cursor = nextCursor, !isLoading, item.id == items.last?.id else { return }
        let generation = loadGeneration
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await api.listLinks(cursor: cursor, search: search, source: filter.query)
            guard generation == loadGeneration else { return }
            let known = Set(items.map(\.id))
            items += page.items.filter { !known.contains($0.id) }
            nextCursor = page.nextCursor
        } catch {
            handle(error)
        }
    }

    func reloadPendingShares() {
        pendingShares = store.pendingShares()
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await reload()
        }
    }

    /// 剛分享的連結還在抓標題：每幾秒更新一次，直到都處理好
    private func pollWhilePending() {
        pollTask?.cancel()
        guard items.contains(where: { $0.status == .pending }) else { return }
        pollTask = Task {
            for attempt in 0..<12 {
                try? await Task.sleep(for: .seconds(attempt < 4 ? 2 : 5))
                guard !Task.isCancelled else { return }
                guard let page = try? await api.listLinks(search: search, source: filter.query) else { continue }
                let updated = Dictionary(page.items.map { ($0.id, $0) }) { first, _ in first }
                items = items.map { updated[$0.id] ?? $0 }
                // 新分享進來的（例如從 Share Extension）放到最上面
                let known = Set(items.map(\.id))
                let fresh = page.items.filter { !known.contains($0.id) && $0.id != pendingDeletion?.id }
                if !fresh.isEmpty { items.insert(contentsOf: fresh, at: 0) }
                if !items.contains(where: { $0.status == .pending }) { return }
            }
        }
    }

    // MARK: 動作

    func add(fromPasted strings: [String]) async {
        guard let url = strings.lazy.compactMap({ URLExtraction.firstURL(in: $0) }).first else {
            errorMessage = "剪貼簿裡沒有網址"
            Haptics.warning()
            return
        }
        do {
            let result = try await api.addLink(url, hints: MetadataHints())
            Haptics.success()
            if result.isNew {
                items.removeAll { $0.id == result.item.id }
                items.insert(result.item, at: 0)
                pollWhilePending()
            } else {
                errorMessage = "之前存過了"
            }
        } catch let error as APIError where error.isRetryable {
            store.enqueue(PendingShare(url: url, hints: MetadataHints()))
            pendingShares = store.pendingShares()
            Haptics.success()
        } catch {
            handle(error)
        }
    }

    func updateTags(_ item: LinkItem, tags: [String]) async {
        store.rememberTags(tags)
        replace(item.id) { $0.tags = tags }
        do {
            let updated = try await api.updateTags(id: item.id, tags: tags)
            replace(item.id) { $0 = updated }
        } catch {
            replace(item.id) { $0.tags = item.tags }
            handle(error)
        }
    }

    func refetch(_ item: LinkItem) async {
        replace(item.id) { $0.status = .pending }
        do {
            try await api.refreshLink(id: item.id)
            pollWhilePending()
        } catch {
            replace(item.id) { $0.status = item.status }
            handle(error)
        }
    }

    func delete(_ item: LinkItem) {
        commitPendingDeletion()
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        Haptics.tap()
        deletionIndex = index
        pendingDeletion = item
        _ = withAnimation { items.remove(at: index) }
        deletionTask = Task {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            commitPendingDeletion()
        }
    }

    func undoDeletion() {
        deletionTask?.cancel()
        guard let item = pendingDeletion else { return }
        pendingDeletion = nil
        withAnimation {
            items.insert(item, at: min(deletionIndex, items.count))
        }
    }

    /// 復原時限到了（或又刪了另一筆）才真的刪除
    func commitPendingDeletion() {
        deletionTask?.cancel()
        guard let item = pendingDeletion else { return }
        pendingDeletion = nil
        Task {
            do {
                try await api.deleteLink(id: item.id)
            } catch APIError.notFound {
                // 已經被刪了
            } catch {
                items.insert(item, at: min(deletionIndex, items.count))
                handle(error)
            }
        }
    }

    func reset() {
        items = []
        pendingShares = []
        nextCursor = nil
        hasLoaded = false
        search = ""
        filter = .all
    }

    private func replace(_ id: String, _ change: (inout LinkItem) -> Void) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        change(&items[index])
    }

    private func handle(_ error: Error) {
        if case APIError.unauthorized = error {
            onUnauthorized?()
            return
        }
        errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
}
