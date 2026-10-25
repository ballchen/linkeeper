import LinkKeeperKit
import SwiftUI

struct RootView: View {
    @Environment(SessionModel.self) private var session

    var body: some View {
        Group {
            switch session.state {
            case .signedOut:
                OnboardingView()
                    .transition(.opacity)
            case .signedIn(let profile):
                if session.needsSetup {
                    SetupView(email: profile.email) { session.completeSetup() }
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                } else {
                    LibraryView()
                        .transition(.opacity)
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: session.state)
        .animation(.easeInOut(duration: 0.3), value: session.needsSetup)
        .background(Palette.bg.ignoresSafeArea())
    }
}

/// 品牌標誌：圓角方塊裡的 L
struct BrandMark: View {
    var size: CGFloat = 56

    var body: some View {
        Text("L")
            .font(.system(size: size * 0.5, weight: .bold, design: .serif))
            .foregroundStyle(Palette.accentInk)
            .frame(width: size, height: size)
            .background(Palette.accent, in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
            .accessibilityHidden(true)
    }
}
