import Foundation
import Security

/// 存在共用 Keychain access group 的憑證，App 與 Share Extension 都讀得到。
public final class CredentialStore: Sendable {
    public static let shared = CredentialStore(accessGroup: AppConfig.keychainGroup)

    private enum Key: String {
        case deviceToken, deviceId, jwt
    }

    private let accessGroup: String
    private let service = "LinkKeeper"

    public init(accessGroup: String) {
        self.accessGroup = accessGroup
    }

    /// 長效 token（lkd_…），用來新增、讀取連結
    public var deviceToken: String? { read(.deviceToken) }
    /// server 上這台裝置的 id，設定頁用來標示「這台裝置」
    public var deviceId: String? { read(.deviceId) }
    /// 7 天效期的 JWT，只用於裝置管理；過期時 App 會重新跟 Google 換
    public var jwt: String? { read(.jwt) }

    public var isSignedIn: Bool { deviceToken != nil }

    public func saveDevice(token: String, id: String) {
        write(token, for: .deviceToken)
        write(id, for: .deviceId)
    }

    public func saveJWT(_ jwt: String?) {
        if let jwt { write(jwt, for: .jwt) } else { delete(.jwt) }
    }

    public func clear() {
        delete(.deviceToken)
        delete(.deviceId)
        delete(.jwt)
    }

    private func baseQuery(_ key: Key) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }

    private func read(_ key: Key) -> String? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func write(_ value: String, for key: Key) {
        let data = Data(value.utf8)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            // Share Extension 可能在鎖定後不久被叫起來，用 AfterFirstUnlock
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(baseQuery(key) as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            let query = baseQuery(key).merging(attributes) { $1 }
            SecItemAdd(query as CFDictionary, nil)
        }
    }

    private func delete(_ key: Key) {
        SecItemDelete(baseQuery(key) as CFDictionary)
    }
}
