import LinkKeeperKit
import SwiftUI

struct EmptyLibraryView: View {
    let onPaste: ([String]) -> Void
    let onShowSetup: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            illustration

            Text("還沒有收藏")
                .font(.display(.title2))
                .foregroundStyle(Palette.ink)
                .padding(.top, 28)

            Text("在任何 App 按**分享** → **LinkKeeper**，連結就會出現在這裡。")
                .font(.subheadline)
                .foregroundStyle(Palette.ink2)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .padding(.top, 10)

            VStack(spacing: 10) {
                Button("看怎麼加到分享選單", action: onShowSetup)
                    .buttonStyle(PrimaryButtonStyle())

                PasteButton(payloadType: String.self) { strings in
                    onPaste(strings)
                }
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .tint(Palette.surface)
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity)
            }
            .padding(.top, 28)

            Text("也可以先在其他 App 拷貝連結，再按上面的貼上")
                .font(.caption)
                .foregroundStyle(Palette.ink3)
                .padding(.top, 10)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: 420)
    }

    private var illustration: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Palette.bgDeep)
                .frame(width: 120, height: 84)
                .rotationEffect(.degrees(-8))
                .offset(x: -14, y: 6)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Palette.surface)
                .frame(width: 120, height: 84)
                .overlay(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 8) {
                        Capsule().fill(Palette.line).frame(width: 84, height: 8)
                        Capsule().fill(Palette.bgDeep).frame(width: 54, height: 8)
                        Spacer()
                        Capsule().fill(Palette.accentTint).frame(width: 36, height: 16)
                    }
                    .padding(14)
                }
                .shadow(color: Palette.shadow, radius: 16, y: 10)
                .offset(x: 6, y: -4)
            Image(systemName: "square.and.arrow.up")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Palette.accentInk)
                .frame(width: 44, height: 44)
                .background(Palette.accent, in: Circle())
                .shadow(color: Palette.accentStrong.opacity(0.4), radius: 10, y: 6)
                .offset(x: 62, y: 36)
        }
        .frame(width: 168, height: 128)
        .accessibilityHidden(true)
    }
}
