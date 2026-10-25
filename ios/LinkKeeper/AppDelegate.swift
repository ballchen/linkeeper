import BackgroundTasks
import LinkKeeperKit
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        BackgroundRefresh.register()
        return true
    }

    /// Share Extension 交給背景 session 的上傳完成時，系統會叫醒 App
    func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
        guard identifier == BackgroundUploader.sessionIdentifier else {
            completionHandler()
            return
        }
        BackgroundUploader.shared.handleEvents(completionHandler: completionHandler)
    }
}

/// 有分享卡在佇列時，請系統找時間在背景補送
enum BackgroundRefresh {
    static let identifier = "\(Bundle.main.bundleIdentifier ?? "linkkeeper").upload"

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            let box = UncheckedSendable(task)
            let work = Task {
                let result = await UploadQueue.shared.drain()
                if result.remaining > 0 { scheduleIfNeeded() }
                box.value.setTaskCompleted(success: result.remaining == 0)
            }
            task.expirationHandler = { work.cancel() }
        }
    }

    static func scheduleIfNeeded() {
        guard !SharedStore.shared.pendingShares().isEmpty else { return }
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}

/// BGTask 不是 Sendable，但系統保證可以在任何 thread 呼叫 setTaskCompleted
private struct UncheckedSendable<Value>: @unchecked Sendable {
    let value: Value
    init(_ value: Value) { self.value = value }
}
