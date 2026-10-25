import Foundation

/// 從 Info.plist 讀取建置設定（值來自 Config/*.xcconfig）；App 與 Share Extension 共用。
public enum AppConfig {
    public static let apiBaseURL = url(for: "LKAPIBaseURL")
    public static let webURL = url(for: "LKWebURL")
    public static let appGroup = string(for: "LKAppGroup")
    public static let keychainGroup = string(for: "LKKeychainGroup")

    public static var appVersion: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\(version)（\(build)）"
    }

    private static func string(for key: String) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String, !value.isEmpty else {
            fatalError("Info.plist 缺少 \(key)，請檢查 Config/Base.xcconfig")
        }
        return value
    }

    private static func url(for key: String) -> URL {
        guard let url = URL(string: string(for: key)) else {
            fatalError("Info.plist 的 \(key) 不是合法網址")
        }
        return url
    }
}
