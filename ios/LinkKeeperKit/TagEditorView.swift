import SwiftUI

/// 編輯標籤：Share Extension 存好後加標籤、App 裡編輯標籤都用這個畫面
public struct TagEditorView: View {
    @State private var tags: [String]
    @State private var draft = ""
    @FocusState private var isFocused: Bool

    private let suggestions: [String]
    private let onDone: ([String]) -> Void
    private let onCancel: (() -> Void)?

    public init(tags: [String], suggestions: [String], onDone: @escaping ([String]) -> Void, onCancel: (() -> Void)? = nil) {
        _tags = State(initialValue: tags)
        self.suggestions = suggestions
        self.onDone = onDone
        self.onCancel = onCancel
    }

    private var trimmedDraft: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var matches: [String] {
        guard !trimmedDraft.isEmpty else { return [] }
        return suggestions.filter { $0.localizedCaseInsensitiveContains(trimmedDraft) && !tags.contains($0) }
    }

    private var unusedSuggestions: [String] {
        suggestions.filter { !tags.contains($0) }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    inputField

                    if !trimmedDraft.isEmpty {
                        section("符合") {
                            FlowLayout(spacing: 8) {
                                if !tags.contains(trimmedDraft) && !suggestions.contains(trimmedDraft) {
                                    TagChip("新增「\(trimmedDraft)」", style: .accent) { add(trimmedDraft) }
                                }
                                ForEach(matches, id: \.self) { tag in
                                    TagChip(tag, style: .plain) { add(tag) }
                                }
                            }
                        }
                    } else if !unusedSuggestions.isEmpty {
                        section("最近使用") {
                            FlowLayout(spacing: 8) {
                                ForEach(unusedSuggestions, id: \.self) { tag in
                                    TagChip(tag, style: .plain) { add(tag) }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.never)
        }
        .background(Palette.surface)
        .onAppear { isFocused = true }
    }

    private var header: some View {
        ZStack {
            Text("標籤")
                .font(.headline)
                .foregroundStyle(Palette.ink)
            HStack {
                if let onCancel {
                    Button("取消", action: onCancel)
                        .foregroundStyle(Palette.ink2)
                }
                Spacer()
                Button("完成") { finish() }
                    .font(.body.weight(.bold))
                    .foregroundStyle(Palette.accentStrong)
            }
        }
        .frame(minHeight: 44)
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    private var inputField: some View {
        FlowLayout(spacing: 8) {
            ForEach(tags, id: \.self) { tag in
                TagChip(tag, style: .selected) { tags.removeAll { $0 == tag } }
                    .accessibilityHint("移除標籤")
            }
            TextField(tags.isEmpty ? "輸入標籤，例如「待看」" : "再加一個", text: $draft)
                .focused($isFocused)
                .submitLabel(.done)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .frame(minWidth: 120, minHeight: 32)
                .onSubmit {
                    if trimmedDraft.isEmpty {
                        finish()
                    } else {
                        add(trimmedDraft)
                    }
                }
                .onChange(of: draft) { _, value in
                    // 打逗號或空白也當作確認
                    if let last = value.last, last == "," || last == "，" {
                        add(String(value.dropLast()))
                    }
                }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.bg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(isFocused ? Palette.accent : Palette.line, lineWidth: isFocused ? 1.5 : 1))
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.footnote.weight(.bold))
                .foregroundStyle(Palette.ink3)
            content()
        }
    }

    private func add(_ raw: String) {
        draft = ""
        guard let tag = TagRules.normalize(raw), !tags.contains(tag), tags.count < TagRules.maxTags else { return }
        Haptics.tap()
        tags.append(tag)
    }

    private func finish() {
        if !trimmedDraft.isEmpty { add(trimmedDraft) }
        onDone(tags)
    }
}

public struct TagChip: View {
    public enum Style { case plain, selected, accent, compact }

    private let title: String
    private let style: Style
    private let action: (() -> Void)?

    public init(_ title: String, style: Style = .compact, action: (() -> Void)? = nil) {
        self.title = title
        self.style = style
        self.action = action
    }

    public var body: some View {
        if let action {
            Button(action: action) { label }
                .buttonStyle(.plain)
        } else {
            label
        }
    }

    private var label: some View {
        HStack(spacing: 4) {
            Text(title).lineLimit(1)
            if style == .selected {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
            }
        }
        .font(style == .compact ? .caption.weight(.medium) : .subheadline.weight(.medium))
        .padding(.horizontal, style == .compact ? 8 : 12)
        .frame(minHeight: style == .compact ? 22 : 32)
        .foregroundStyle(foreground)
        .background(background, in: Capsule())
        .overlay {
            if style == .plain { Capsule().strokeBorder(Palette.line) }
        }
    }

    private var foreground: Color {
        switch style {
        case .plain: Palette.ink
        case .selected: Palette.accentInk
        case .accent, .compact: Palette.accentStrong
        }
    }

    private var background: Color {
        switch style {
        case .plain: Palette.surface
        case .selected: Palette.accent
        case .accent, .compact: Palette.accentTint
        }
    }
}

/// 標籤用的換行排版
public struct FlowLayout: Layout {
    var spacing: CGFloat

    public init(spacing: CGFloat = 8) {
        self.spacing = spacing
    }

    public func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews: subviews, width: proposal.width ?? .infinity)
        let height = rows.last.map { $0.y + $0.height } ?? 0
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    public func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(subviews: subviews, width: bounds.width)
        for row in rows {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                let width = min(size.width, bounds.width)
                subviews[index].place(
                    at: CGPoint(x: x, y: bounds.minY + row.y + (row.height - size.height) / 2),
                    proposal: ProposedViewSize(width: width, height: size.height)
                )
                x += width + spacing
            }
        }
    }

    private struct Row {
        var indices: [Int] = []
        var y: CGFloat = 0
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(subviews: Subviews, width maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let itemWidth = min(size.width, maxWidth)
            var row = rows[rows.count - 1]
            let proposedWidth = row.indices.isEmpty ? itemWidth : row.width + spacing + itemWidth
            if proposedWidth > maxWidth, !row.indices.isEmpty {
                let y = row.y + row.height + spacing
                rows.append(Row(indices: [index], y: y, width: itemWidth, height: size.height))
                continue
            }
            row.indices.append(index)
            row.width = proposedWidth
            row.height = max(row.height, size.height)
            rows[rows.count - 1] = row
        }
        return rows.filter { !$0.indices.isEmpty }
    }
}
