import Foundation
import LinkKeeperKit
import Observation

@MainActor
@Observable
final class ShareModel {
    enum Phase: Equatable {
        case saving(host: String?)
        /// 新存的連結
        case saved
        /// 之前就存過
        case duplicate
        /// 沒網路，先存在手機上
        case queued
        case needsSignIn
        /// 分享內容裡沒有網址（唯一不自動關閉的情況）
        case noURL
        case rejected(String)
    }

    private(set) var phase: Phase = .saving(host: nil)
    private(set) var item: LinkItem?
    private(set) var preview = MetadataHints()
    private(set) var previewURL: URL?
    private(set) var tags: [String] = []
    var isEditingTags = false

    /// 自動關閉的倒數；nil 表示已停住（使用者點了東西）
    private(set) var autoClose: AutoClose?

    struct AutoClose: Equatable {
        let duration: TimeInterval
        let startedAt: Date
    }

    private var pendingShare: PendingShare?
    private var autoCloseTask: Task<Void, Never>?
    private let api = APIClient.shared
    private let store = SharedStore.shared
    private let credentials = CredentialStore.shared
    private let finish: () -> Void

    init(finish: @escaping () -> Void) {
        self.finish = finish
    }

    var suggestions: [String] { store.recentTags }

    func start(with items: [NSExtensionItem]) async {
        guard let input = await ShareInput.extract(from: items) else {
            phase = .noURL
            Haptics.warning()
            return
        }

        preview = input.hints
        previewURL = input.url
        phase = .saving(host: input.url.host(percentEncoded: false))

        // 先存進佇列：之後不管發生什麼事，連結都不會丟
        let share = PendingShare(url: input.url, hints: input.hints)
        store.enqueue(share)
        pendingShare = share

        guard credentials.isSignedIn else {
            phase = .needsSignIn
            scheduleAutoClose(after: 3.5)
            return
        }

        do {
            let result = try await api.addLink(input.url, hints: input.hints, timeout: 10)
            store.removePendingShare(id: share.id)
            pendingShare = nil
            item = result.item
            tags = result.item.tags
            if result.isNew {
                phase = .saved
                Haptics.success()
                scheduleAutoClose(after: 1.8)
            } else {
                phase = .duplicate
                scheduleAutoClose(after: 2.5)
            }
        } catch let error as APIError where error.isRetryable {
            BackgroundUploader.shared.schedule(share)
            phase = .queued
            Haptics.success()
            scheduleAutoClose(after: 3)
        } catch APIError.unauthorized {
            // token 被移除了；連結留在佇列，重新登入後上傳
            phase = .needsSignIn
            scheduleAutoClose(after: 3.5)
        } catch {
            store.removePendingShare(id: share.id)
            pendingShare = nil
            phase = .rejected(error.localizedDescription)
        }
    }

    // MARK: 使用者動作

    func pauseAutoClose() {
        autoCloseTask?.cancel()
        autoClose = nil
    }

    func editTags() {
        pauseAutoClose()
        isEditingTags = true
    }

    func saveTags(_ newTags: [String]) {
        isEditingTags = false
        tags = newTags
        store.rememberTags(newTags)

        if let item {
            Task {
                do {
                    _ = try await api.updateTags(id: item.id, tags: newTags)
                } catch {
                    // 網路斷了就交給佇列：重送時 server 會判斷為重複並補上標籤
                    store.enqueue(PendingShare(url: item.url, hints: MetadataHints(), tags: newTags))
                }
            }
        } else if let pendingShare {
            store.updatePendingShares { queue in
                if let index = queue.firstIndex(where: { $0.id == pendingShare.id }) {
                    queue[index].tags = newTags
                }
            }
        }
        Haptics.success()
        scheduleAutoClose(after: 1.2)
    }

    func cancelTags() {
        isEditingTags = false
        scheduleAutoClose(after: 1.8)
    }

    func undo() {
        pauseAutoClose()
        if let pendingShare {
            store.removePendingShare(id: pendingShare.id)
            finish()
            return
        }
        guard let item, phase == .saved else {
            finish()
            return
        }
        Task {
            try? await api.deleteLink(id: item.id)
            Haptics.tap()
            finish()
        }
    }

    func close() {
        autoCloseTask?.cancel()
        // 還沒等到 server 回應就關掉：交給背景 session 送，佇列裡也還留著
        if case .saving = phase, let pendingShare {
            BackgroundUploader.shared.schedule(pendingShare)
        }
        finish()
    }

    private func scheduleAutoClose(after duration: TimeInterval) {
        autoCloseTask?.cancel()
        autoClose = AutoClose(duration: duration, startedAt: Date())
        autoCloseTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            self?.finish()
        }
    }
}
