@preconcurrency import GoogleSignIn
import LinkKeeperKit
import SwiftUI
import UIKit

/// 登入狀態。Google 登入 → server JWT → 換一組長效 device token 存進共用 Keychain，
/// 之後 App 與 Share Extension 都用 device token，不必再登入。
@MainActor
@Observable
final class SessionModel {
    enum State: Equatable {
        case signedOut
        case signedIn(UserProfile)
    }

    private(set) var state: State
    private(set) var isSigningIn = false
    var signInError: String?
    /// 剛登入、還沒看過「加到分享選單」的教學
    var needsSetup: Bool

    private let api = APIClient.shared
    private let credentials = CredentialStore.shared
    private let store = SharedStore.shared

    init() {
        #if DEBUG
        // 開發用：xcrun simctl launch … -LKDebugDeviceToken lkd_… 直接登入，不必走 Google
        if let token = UserDefaults.standard.string(forKey: "LKDebugDeviceToken") {
            credentials.saveDevice(token: token, id: "debug")
            store.profile = store.profile ?? UserProfile(email: "debug@localhost", name: "Debug", picture: nil)
        }
        if UserDefaults.standard.bool(forKey: "LKDebugSkipSetup") {
            store.hasCompletedSetup = true
        }
        #endif
        if credentials.isSignedIn, let profile = store.profile {
            state = .signedIn(profile)
        } else {
            state = .signedOut
        }
        needsSetup = !store.hasCompletedSetup
    }

    var profile: UserProfile? {
        if case .signedIn(let profile) = state { return profile }
        return nil
    }

    func signIn() async {
        guard let presenter = UIApplication.shared.topViewController else { return }
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String, !clientID.isEmpty else {
            signInError = "尚未設定 Google iOS client ID（Config/Local.xcconfig）"
            return
        }
        isSigningIn = true
        signInError = nil
        defer { isSigningIn = false }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let idToken = result.user.idToken?.tokenString else {
                signInError = "Google 沒有回傳登入資訊，請再試一次"
                return
            }
            let login = try await api.loginWithGoogle(idToken: idToken)
            let issued = try await api.issueDeviceToken(jwt: login.jwt, deviceName: UIDevice.current.name)

            credentials.saveDevice(token: issued.token, id: issued.device.id)
            credentials.saveJWT(login.jwt)
            store.profile = login.profile
            state = .signedIn(login.profile)
            Haptics.success()

            // 未登入時分享的連結，現在送出去
            Task { _ = await UploadQueue.shared.drain() }
        } catch let error as GIDSignInError where error.code == .canceled {
            return
        } catch APIError.unauthorized {
            signInError = "這個 Google 帳號沒有使用權限"
        } catch {
            signInError = error.localizedDescription
        }
    }

    func completeSetup() {
        store.hasCompletedSetup = true
        needsSetup = false
    }

    /// 裝置管理要用 JWT；過期就用 Google 的 session 悄悄換一組新的
    func freshJWT() async throws -> String {
        if let jwt = credentials.jwt, !Self.isExpired(jwt) {
            return jwt
        }
        let user: GIDGoogleUser
        if let current = GIDSignIn.sharedInstance.currentUser {
            user = current
        } else {
            user = try await GIDSignIn.sharedInstance.restorePreviousSignIn()
        }
        let refreshed = try await user.refreshTokensIfNeeded()
        guard let idToken = refreshed.idToken?.tokenString else { throw APIError.unauthorized }
        let login = try await api.loginWithGoogle(idToken: idToken)
        credentials.saveJWT(login.jwt)
        return login.jwt
    }

    func signOut() async {
        // 盡量從 server 撤銷這台裝置的 token；失敗也照樣登出
        if let deviceId = credentials.deviceId, let jwt = try? await freshJWT() {
            try? await api.revokeDevice(id: deviceId, jwt: jwt)
        }
        clearLocalSession()
    }

    /// device token 被撤銷（例如從其他裝置移除）時呼叫
    func handleUnauthorized() {
        clearLocalSession()
        signInError = "登入已失效，請重新登入"
    }

    private func clearLocalSession() {
        GIDSignIn.sharedInstance.signOut()
        credentials.clear()
        store.clearAccount()
        state = .signedOut
    }

    private static func isExpired(_ jwt: String) -> Bool {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else { return true }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval else { return true }
        // 留一分鐘緩衝
        return Date(timeIntervalSince1970: exp) < Date().addingTimeInterval(60)
    }
}

extension UIApplication {
    var topViewController: UIViewController? {
        let scene = connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
            ?? connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var controller = scene?.keyWindow?.rootViewController
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }
}
