import Foundation

/// App Group 裡的共用資料：等待上傳的佇列、最近用過的標籤、帳號資訊。
/// App 與 Share Extension 是不同 process，佇列檔案用 NSFileCoordinator 互斥。
public final class SharedStore: @unchecked Sendable {
    public static let shared = SharedStore(appGroup: AppConfig.appGroup)

    public static let maxRecentTags = 12

    private let defaults: UserDefaults
    private let queueURL: URL
    private let lock = NSLock()

    public init(appGroup: String) {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
              let defaults = UserDefaults(suiteName: appGroup) else {
            fatalError("無法存取 App Group \(appGroup)，請檢查 entitlements")
        }
        self.defaults = defaults
        queueURL = container.appending(path: "pending-shares.json")
    }

    public var containerURL: URL { queueURL.deletingLastPathComponent() }

    // MARK: 上傳佇列

    public func pendingShares() -> [PendingShare] {
        var result: [PendingShare] = []
        coordinate(writing: false) { url in
            result = Self.readQueue(at: url)
        }
        return result
    }

    /// 在同一次檔案鎖內讀取、修改、寫回，避免 App 與 Extension 互相覆蓋
    @discardableResult
    public func updatePendingShares<T>(_ body: (inout [PendingShare]) -> T) -> T {
        var output: T!
        coordinate(writing: true) { url in
            var queue = Self.readQueue(at: url)
            output = body(&queue)
            if let data = try? JSONEncoder().encode(queue) {
                try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            }
        }
        return output
    }

    public func enqueue(_ share: PendingShare) {
        updatePendingShares { queue in
            // 同一個網址只保留一筆，標籤合併
            if let index = queue.firstIndex(where: { $0.url == share.url }) {
                queue[index].tags = (queue[index].tags + share.tags).uniqued()
            } else {
                queue.append(share)
            }
        }
    }

    public func removePendingShare(id: UUID) {
        updatePendingShares { queue in queue.removeAll { $0.id == id } }
    }

    private func coordinate(writing: Bool, _ body: (URL) -> Void) {
        lock.lock()
        defer { lock.unlock() }
        let coordinator = NSFileCoordinator()
        var error: NSError?
        if writing {
            coordinator.coordinate(writingItemAt: queueURL, options: [], error: &error, byAccessor: body)
        } else {
            coordinator.coordinate(readingItemAt: queueURL, options: [], error: &error, byAccessor: body)
        }
    }

    private static func readQueue(at url: URL) -> [PendingShare] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([PendingShare].self, from: data)) ?? []
    }

    // MARK: 標籤

    public var recentTags: [String] {
        defaults.stringArray(forKey: "recentTags") ?? []
    }

    /// 剛用過的排最前面
    public func rememberTags(_ tags: [String]) {
        guard !tags.isEmpty else { return }
        let merged = tags + recentTags.filter { !tags.contains($0) }
        defaults.set(Array(merged.prefix(Self.maxRecentTags)), forKey: "recentTags")
    }

    /// App 讀到收藏庫時，用實際存在的標籤補足建議（不打亂最近使用的順序）
    public func mergeKnownTags(_ tags: [String]) {
        let recent = recentTags
        let extra = tags.filter { !recent.contains($0) }
        guard !extra.isEmpty, recent.count < Self.maxRecentTags else { return }
        defaults.set(Array((recent + extra).prefix(Self.maxRecentTags)), forKey: "recentTags")
    }

    // MARK: 帳號

    public var profile: UserProfile? {
        get {
            defaults.data(forKey: "profile").flatMap { try? JSONDecoder().decode(UserProfile.self, from: $0) }
        }
        set {
            defaults.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: "profile")
        }
    }

    public var hasCompletedSetup: Bool {
        get { defaults.bool(forKey: "hasCompletedSetup") }
        set { defaults.set(newValue, forKey: "hasCompletedSetup") }
    }

    public func clearAccount() {
        profile = nil
        defaults.removeObject(forKey: "recentTags")
    }
}
