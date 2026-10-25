@preconcurrency import GoogleSignIn
import LinkKeeperKit
import SwiftUI

@main
struct LinkKeeperApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = SessionModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        Appearance.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .tint(Palette.accent)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                BackgroundRefresh.scheduleIfNeeded()
            }
        }
    }
}

@MainActor
enum Appearance {
    /// 導覽列大標題用襯線字，和網頁版的 Fraunces 標題呼應
    static func configure() {
        let ink = UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.94, green: 0.91, blue: 0.85, alpha: 1) : UIColor(red: 0.13, green: 0.11, blue: 0.08, alpha: 1) }
        let background = UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.09, green: 0.075, blue: 0.05, alpha: 1) : UIColor(red: 0.965, green: 0.95, blue: 0.918, alpha: 1) }

        func serif(_ style: UIFont.TextStyle) -> UIFont {
            let base = UIFontDescriptor.preferredFontDescriptor(withTextStyle: style)
            let descriptor = base.withDesign(.serif)?.withSymbolicTraits(.traitBold) ?? base
            return UIFont(descriptor: descriptor, size: 0)
        }

        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = background
        appearance.shadowColor = .clear
        appearance.largeTitleTextAttributes = [.font: serif(.largeTitle), .foregroundColor: ink]
        appearance.titleTextAttributes = [.font: serif(.headline), .foregroundColor: ink]

        let bar = UINavigationBar.appearance()
        bar.standardAppearance = appearance
        bar.scrollEdgeAppearance = appearance
        bar.compactAppearance = appearance
    }
}
