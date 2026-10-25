import LinkKeeperKit
import SwiftUI

/// 教使用者把 LinkKeeper 釘到分享選單第一排：這是會不會常用的關鍵
struct SetupView: View {
    var email: String?
    var finishTitle = "稍後再說"
    let onFinish: () -> Void

    private static let sampleURL = URL(string: "https://www.apple.com/tw/ios/")!

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let email {
                    Label("已登入 \(email)", systemImage: "checkmark.circle.fill")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Palette.success)
                        .padding(.horizontal, 12)
                        .frame(minHeight: 30)
                        .background(Palette.successTint, in: Capsule())
                        .padding(.top, 16)
                }

                Text("最後一步：\n把 LinkKeeper 放到分享選單第一排")
                    .font(.display(.title))
                    .foregroundStyle(Palette.ink)
                    .padding(.top, 20)
                    .fixedSize(horizontal: false, vertical: true)

                shareSheetIllustration
                    .padding(.top, 28)

                VStack(alignment: .leading, spacing: 18) {
                    step(1, "在任何 App 點 **分享**，把 App 列滑到最右邊，點 **更多**")
                    step(2, "點右上角 **編輯**，把 LinkKeeper 加到 **喜好項目** 並拖到最上面")
                }
                .padding(.top, 28)
            }
            .padding(.horizontal, 24)
        }
        .scrollBounceBehavior(.basedOnSize)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 10) {
                ShareLink(item: Self.sampleURL) {
                    Text("用範例連結試一次")
                }
                .buttonStyle(PrimaryButtonStyle())

                Button(finishTitle, action: onFinish)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Palette.ink2)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 8)
            .background(Palette.bg)
        }
        .background(Palette.bg.ignoresSafeArea())
    }

    private var shareSheetIllustration: some View {
        HStack(spacing: 0) {
            appIcon("LinkKeeper") {
                BrandMark(size: 52)
            }
            .overlay(alignment: .topTrailing) {
                Image(systemName: "star.fill")
                    .font(.caption2)
                    .foregroundStyle(Palette.accentInk)
                    .padding(4)
                    .background(Palette.accentStrong, in: Circle())
                    .offset(x: 6, y: -6)
            }
            appIcon("訊息") { placeholderIcon("message.fill", Color(red: 0.2, green: 0.78, blue: 0.35)) }
            appIcon("郵件") { placeholderIcon("envelope.fill", Color(red: 0.1, green: 0.5, blue: 0.95)) }
            appIcon("備忘錄") { placeholderIcon("note.text", Color(red: 0.98, green: 0.78, blue: 0.2)) }
            appIcon("更多") { placeholderIcon("ellipsis", Palette.ink3) }
        }
        .padding(.vertical, 18)
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: Palette.shadow, radius: 16, y: 8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("分享選單示意圖：LinkKeeper 排在第一個")
    }

    private func appIcon(_ label: String, @ViewBuilder icon: () -> some View) -> some View {
        VStack(spacing: 6) {
            icon()
            Text(label)
                .font(.caption2)
                .foregroundStyle(Palette.ink2)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }

    private func placeholderIcon(_ symbol: String, _ color: Color) -> some View {
        Image(systemName: symbol)
            .font(.title3)
            .foregroundStyle(.white)
            .frame(width: 52, height: 52)
            .background(color, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(0.55)
    }

    private func step(_ number: Int, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text("\(number)")
                .font(.footnote.weight(.bold))
                .foregroundStyle(Palette.accentStrong)
                .frame(width: 28, height: 28)
                .background(Palette.accentTint, in: Circle())
            Text(text)
                .font(.body)
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 3)
        }
        .accessibilityElement(children: .combine)
    }
}
