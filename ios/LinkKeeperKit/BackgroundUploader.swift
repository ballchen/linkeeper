import Foundation

/// 用背景 URLSession 交給系統補送：Share Extension 關掉、App 沒開也會在有網路時送出。
/// 送達後從佇列移除；結果若回到 App（handleEventsForBackgroundURLSession），也由這裡處理。
public final class BackgroundUploader: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    public static let shared = BackgroundUploader()

    public static let sessionIdentifier = "\(Bundle.main.bundleIdentifier?.components(separatedBy: ".share").first ?? "linkkeeper").background-upload"

    private let store: SharedStore
    private let lock = NSLock()
    private var completionHandler: (() -> Void)?
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
        configuration.sharedContainerIdentifier = AppConfig.appGroup
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    public init(store: SharedStore = .shared) {
        self.store = store
    }

    public func schedule(_ share: PendingShare) {
        guard var request = try? APIClient.shared.addLinkRequest(for: share), let body = request.httpBody else { return }
        request.httpBody = nil

        // 背景 session 只能從檔案上傳
        let file = store.containerURL.appending(path: "upload-\(share.id.uuidString).json")
        do {
            try body.write(to: file, options: .atomic)
        } catch {
            return
        }
        let task = session.uploadTask(with: request, fromFile: file)
        task.taskDescription = share.id.uuidString
        task.resume()
    }

    /// App 被系統叫起來處理背景 session 事件時呼叫
    public func handleEvents(completionHandler: @escaping () -> Void) {
        lock.withLock { self.completionHandler = completionHandler }
        _ = session
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let idString = task.taskDescription, let id = UUID(uuidString: idString) else { return }
        try? FileManager.default.removeItem(at: store.containerURL.appending(path: "upload-\(idString).json"))

        let status = (task.response as? HTTPURLResponse)?.statusCode ?? 0
        if error == nil, (200..<300).contains(status) {
            store.removePendingShare(id: id)
        }
        // 其他情況留在佇列，下次開 App 或背景刷新時再送
    }

    public func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        nonisolated(unsafe) let handler = lock.withLock {
            defer { completionHandler = nil }
            return completionHandler
        }
        // 系統要求在 main thread 呼叫
        DispatchQueue.main.async { handler?() }
    }
}
