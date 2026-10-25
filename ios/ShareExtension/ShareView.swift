import LinkKeeperKit
import SwiftUI

/// iOS 會把 Share Extension 放在不透明的整頁 sheet 裡，所以版面以整頁設計：
/// 狀態在中間、預覽卡片在下方、按鈕靠近拇指。
struct ShareView: View {
    @Bindable var model: ShareModel

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()

            if model.isEditingTags {
                TagEditorView(
                    tags: model.tags,
                    suggestions: model.suggestions,
                    onDone: { model.saveTags($0) },
                    onCancel: { model.cancelTags() }
                )
                .transition(.move(edge: .bottom))
            } else {
                statusPage
                    .transition(.opacity)
            }
        }
        .animation(.spring(duration: 0.35, bounce: 0.15), value: model.phase)
        .animation(.spring(duration: 0.35, bounce: 0.1), value: model.isEditingTags)
    }

    private var statusPage: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                if model.phase.isFinal {
                    closeButton
                }
            }
            .frame(height: 44)

            Spacer(minLength: 16)

            status
                .padding(.horizontal, 8)

            if model.phase.showsPreview {
                previewCard
                    .padding(.top, 28)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            Spacer(minLength: 24)

            actions

            autoCloseFooter
                .frame(height: 36)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .contentShape(Rectangle())
        .onTapGesture { model.pauseAutoClose() }
    }

    // MARK: 狀態

    private struct StatusStyle {
        let icon: String
        let title: String
        let message: String?
        let tint: Color
        let background: Color
    }

    private var style: StatusStyle {
        switch model.phase {
        case .saving:
            StatusStyle(icon: "", title: "儲存中⋯", message: nil, tint: Palette.accent, background: Palette.accentTint)
        case .saved:
            StatusStyle(icon: "checkmark", title: "已存到 LinkKeeper", message: nil, tint: Palette.success, background: Palette.successTint)
        case .duplicate:
            StatusStyle(icon: "bookmark.fill", title: "之前存過了", message: duplicateMessage, tint: Palette.ink2, background: Palette.bgDeep)
        case .queued:
            StatusStyle(icon: "iphone.and.arrow.forward", title: "已先存在手機上", message: "目前沒有網路。連上之後會自動上傳，不需要再分享一次。", tint: Palette.success, background: Palette.successTint)
        case .needsSignIn:
            StatusStyle(icon: "person.crop.circle", title: "請先登入一次", message: "打開 LinkKeeper App 用 Google 登入。這個連結已經先保留，登入後會自動上傳。", tint: Palette.accentStrong, background: Palette.accentTint)
        case .noURL:
            StatusStyle(icon: "link.badge.plus", title: "找不到網址", message: "這次分享的內容裡沒有連結。可以在原 App 選「拷貝連結」，再到 LinkKeeper 貼上。", tint: Palette.danger, background: Palette.dangerTint)
        case .rejected(let reason):
            StatusStyle(icon: "exclamationmark.triangle", title: "沒辦法存這個連結", message: reason, tint: Palette.danger, background: Palette.dangerTint)
        }
    }

    private var status: some View {
        let style = style
        return VStack(spacing: 14) {
            ZStack {
                Circle().fill(style.background)
                if case .saving = model.phase {
                    ProgressView()
                        .controlSize(.large)
                        .tint(style.tint)
                } else {
                    Image(systemName: style.icon)
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(style.tint)
                        .contentTransition(.symbolEffect(.replace))
                }
            }
            .frame(width: 76, height: 76)
            .accessibilityHidden(true)

            Text(style.title)
                .font(.display(.title2))
                .foregroundStyle(Palette.ink)
                .multilineTextAlignment(.center)

            if let message = style.message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(Palette.ink2)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            } else if case .saving(let host) = model.phase, let host {
                Text(host)
                    .font(.subheadline)
                    .foregroundStyle(Palette.ink3)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var duplicateMessage: String {
        guard let item = model.item else { return "不會重複新增。" }
        let when = item.createdAt.formatted(.relative(presentation: .named))
        let tags = model.tags.isEmpty ? "" : "，標籤：\(model.tags.joined(separator: "、"))"
        return "\(when)存的\(tags)。不會重複新增。"
    }

    // MARK: 預覽

    private var previewCard: some View {
        let title = model.item?.title ?? model.preview.title
        let image = model.item?.image ?? model.preview.image
        let host = model.item?.host ?? model.previewURL?.host(percentEncoded: false) ?? ""
        let source = model.item?.source?.displayName

        return VStack(alignment: .leading, spacing: 0) {
            if image != nil {
                RemoteImage(url: image, maxPixel: 900)
                    .frame(height: 160)
                    .frame(maxWidth: .infinity)
                    .clipped()
            }
            HStack(alignment: .top, spacing: 12) {
                if image == nil {
                    RemoteImage(url: nil)
                        .frame(width: 52, height: 52)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(title ?? host)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(3)
                    Text(source.map { "\($0) · \(host)" } ?? host)
                        .font(.caption)
                        .foregroundStyle(Palette.ink3)
                        .lineLimit(1)
                    if !model.tags.isEmpty {
                        FlowLayout(spacing: 4) {
                            ForEach(model.tags, id: \.self) { TagChip($0) }
                        }
                        .padding(.top, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(14)
        }
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: Palette.shadow, radius: 18, y: 10)
        .accessibilityElement(children: .combine)
    }

    // MARK: 按鈕

    @ViewBuilder
    private var actions: some View {
        switch model.phase {
        case .saving:
            Color.clear.frame(height: 50)
        case .saved:
            HStack(spacing: 10) {
                Button { model.editTags() } label: {
                    Label(model.tags.isEmpty ? "加標籤" : "編輯標籤", systemImage: "tag")
                }
                .buttonStyle(SecondaryButtonStyle())
                Button("復原") { model.undo() }
                    .buttonStyle(SecondaryButtonStyle())
            }
        case .duplicate, .queued:
            HStack(spacing: 10) {
                Button(model.tags.isEmpty ? "加標籤" : "編輯標籤") { model.editTags() }
                    .buttonStyle(SecondaryButtonStyle())
                Button("好") { model.close() }
                    .buttonStyle(PrimaryButtonStyle())
            }
        case .needsSignIn:
            Button("知道了") { model.close() }
                .buttonStyle(PrimaryButtonStyle())
        case .noURL, .rejected:
            Button("關閉") { model.close() }
                .buttonStyle(PrimaryButtonStyle())
        }
    }

    private var closeButton: some View {
        Button { model.close() } label: {
            Image(systemName: "xmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(Palette.ink2)
                .frame(width: 32, height: 32)
                .background(Palette.bgDeep, in: Circle())
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("關閉")
    }

    @ViewBuilder
    private var autoCloseFooter: some View {
        if let autoClose = model.autoClose {
            VStack(spacing: 6) {
                AutoCloseBar(autoClose: autoClose)
                    .frame(width: 120)
                Text("即將自動關閉 · 點任何地方會停住")
                    .font(.caption2)
                    .foregroundStyle(Palette.ink3)
            }
            .padding(.top, 10)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("即將自動關閉，點任何地方會停住")
        }
    }
}

private extension ShareModel.Phase {
    /// 已有結果（不再是儲存中）
    var isFinal: Bool {
        if case .saving = self { return false }
        return true
    }

    var showsPreview: Bool {
        switch self {
        case .saving, .saved, .duplicate, .queued, .needsSignIn: true
        case .noURL, .rejected: false
        }
    }
}

private struct AutoCloseBar: View {
    let autoClose: ShareModel.AutoClose
    @State private var progress: CGFloat = 0

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.line)
                Capsule().fill(Palette.accent)
                    .frame(width: proxy.size.width * progress)
            }
        }
        .frame(height: 3)
        .onAppear {
            progress = 0
            withAnimation(.linear(duration: autoClose.duration)) { progress = 1 }
        }
        .id(autoClose.startedAt)
    }
}
