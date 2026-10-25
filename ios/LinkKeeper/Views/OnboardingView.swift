import LinkKeeperKit
import SwiftUI

struct OnboardingView: View {
    @Environment(SessionModel.self) private var session

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                BrandMark()
                    .padding(.top, 24)

                Text("看到好東西，\n按一下分享就留住。")
                    .font(.display(.largeTitle))
                    .foregroundStyle(Palette.ink)
                    .padding(.top, 28)
                    .fixedSize(horizontal: false, vertical: true)

                Text("連結從任何 App 存進來，標題和預覽圖自動補上，手機和網頁看到的是同一份收藏。")
                    .font(.body)
                    .foregroundStyle(Palette.ink2)
                    .lineSpacing(4)
                    .padding(.top, 14)

                VStack(alignment: .leading, spacing: 18) {
                    step(1, "在 IG、Threads、YouTube 或 Safari 按 **分享**")
                    step(2, "點 **LinkKeeper**，一秒後自己關掉")
                    step(3, "想看的時候，打開 App 或網頁就在那裡")
                }
                .padding(20)
                .background(Palette.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.top, 32)
            }
            .padding(.horizontal, 24)
        }
        .scrollBounceBehavior(.basedOnSize)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 12) {
                if let error = session.signInError {
                    Text(error)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Palette.danger)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await session.signIn() }
                } label: {
                    HStack(spacing: 10) {
                        if session.isSigningIn {
                            ProgressView().tint(Palette.inverseInk)
                        } else {
                            Text("G")
                                .font(.system(.body, design: .rounded, weight: .heavy))
                        }
                        Text("使用 Google 帳號登入")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(session.isSigningIn)

                Text("只有被允許的帳號可以登入。登入一次後，分享時不需要再登入。")
                    .font(.footnote)
                    .foregroundStyle(Palette.ink3)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .background(Palette.bg)
        }
        .background(Palette.bg.ignoresSafeArea())
    }

    private func step(_ number: Int, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text("\(number)")
                .font(.footnote.weight(.bold))
                .foregroundStyle(Palette.accentStrong)
                .frame(width: 28, height: 28)
                .background(Palette.accentTint, in: Circle())
                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 9 }
            Text(text)
                .font(.body)
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}
