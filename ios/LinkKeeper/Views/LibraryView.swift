import LinkKeeperKit
import SwiftUI

struct LibraryView: View {
    @Environment(SessionModel.self) private var session
    @Environment(\.scenePhase) private var scenePhase
    @State private var library = LibraryStore()
    @State private var opener = LinkOpener()
    @State private var editingTags: LinkItem?
    @State private var showingSettings = false
    @State private var showingSetup = false
    @State private var toast: String?

    var body: some View {
        NavigationStack {
            list
                .navigationTitle("收藏庫")
                .searchable(text: $library.search, placement: .navigationBarDrawer(displayMode: .always), prompt: "搜尋")
                .toolbar { toolbar }
                .refreshable { await library.refresh() }
                .overlay { emptyState }
                .safeAreaInset(edge: .bottom) { bottomToast }
        }
        .task {
            library.onUnauthorized = { session.handleUnauthorized() }
            await library.refresh()
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                // 從其他 App 分享完回來，要看到剛存的
                Task { await library.refresh() }
            case .background:
                library.commitPendingDeletion()
            default:
                break
            }
        }
        .onChange(of: library.errorMessage) { _, message in
            guard let message else { return }
            show(toast: message)
            library.errorMessage = nil
        }
        .sheet(item: $editingTags) { item in
            TagEditorView(
                tags: item.tags,
                suggestions: SharedStore.shared.recentTags,
                onDone: { tags in
                    editingTags = nil
                    Task { await library.updateTags(item, tags: tags) }
                },
                onCancel: { editingTags = nil }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView(library: library)
        }
        .sheet(isPresented: $showingSetup) {
            SetupView(finishTitle: "完成") { showingSetup = false }
        }
        .fullScreenCover(item: $opener.safariURL) { target in
            SafariView(url: target.url).ignoresSafeArea()
        }
    }

    // MARK: 列表

    private var list: some View {
        List {
            Group {
                SourceFilterBar(selection: $library.filter)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))

                if !library.pendingShares.isEmpty {
                    offlineBanner
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 0, trailing: 16))
                }

                ForEach(library.sections) { section in
                    Section {
                        ForEach(section.items) { item in
                            row(item)
                        }
                    } header: {
                        Text(section.title)
                            .font(.footnote.weight(.bold))
                            .foregroundStyle(Palette.ink3)
                            .textCase(nil)
                            .padding(.leading, 4)
                    }
                }

                if library.nextCursor != nil {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Palette.bg)
        .animation(.default, value: library.items)
    }

    private func row(_ item: LinkItem) -> some View {
        Button {
            opener.open(item.url)
        } label: {
            LinkCard(item: item) {
                Task { await library.refetch(item) }
            }
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                library.delete(item)
            } label: {
                Label("刪除", systemImage: "trash")
            }
            .tint(Palette.danger)

            Button {
                editingTags = item
            } label: {
                Label("標籤", systemImage: "tag")
            }
            .tint(Palette.accentStrong)
        }
        .contextMenu {
            contextMenu(for: item)
        } preview: {
            LinkPreview(item: item)
        }
        .task { await library.loadMoreIfNeeded(after: item) }
    }

    @ViewBuilder
    private func contextMenu(for item: LinkItem) -> some View {
        if let source = item.source {
            Button {
                opener.open(item.url)
            } label: {
                Label("在 \(source.displayName) 開啟", systemImage: "arrow.up.forward.app")
            }
        }
        Button {
            opener.openInSafari(item.url)
        } label: {
            Label("用 Safari 開啟", systemImage: "safari")
        }
        Button {
            editingTags = item
        } label: {
            Label("編輯標籤", systemImage: "tag")
        }
        Button {
            UIPasteboard.general.url = item.url
            show(toast: "已拷貝連結")
        } label: {
            Label("拷貝連結", systemImage: "doc.on.doc")
        }
        ShareLink(item: item.url) {
            Label("分享⋯", systemImage: "square.and.arrow.up")
        }
        if item.status == .failed {
            Button {
                Task { await library.refetch(item) }
            } label: {
                Label("重新抓取", systemImage: "arrow.clockwise")
            }
        }
        Divider()
        Button(role: .destructive) {
            library.delete(item)
        } label: {
            Label("刪除", systemImage: "trash")
        }
    }

    private var offlineBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "icloud.and.arrow.up")
                .foregroundStyle(Palette.accentStrong)
            Text("\(library.pendingShares.count) 個連結等待上傳 · 連上網路後自動送出")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 44)
        .background(Palette.accentTint, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var emptyState: some View {
        if library.hasLoaded, library.items.isEmpty, library.pendingDeletion == nil {
            if library.isFiltering {
                ContentUnavailableView.search(text: library.search)
            } else {
                EmptyLibraryView(
                    onPaste: { strings in Task { await library.add(fromPasted: strings) } },
                    onShowSetup: { showingSetup = true }
                )
            }
        } else if !library.hasLoaded, library.isLoading {
            ProgressView()
        }
    }

    // MARK: 工具列

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            PasteButton(payloadType: String.self) { strings in
                Task { await library.add(fromPasted: strings) }
            }
            .labelStyle(.iconOnly)
            .buttonBorderShape(.circle)
            .tint(Palette.accent)
            .accessibilityLabel("貼上連結")

            Button {
                showingSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .foregroundStyle(Palette.ink)
            }
            .accessibilityLabel("設定")
        }
    }

    // MARK: Toast

    @ViewBuilder
    private var bottomToast: some View {
        if let deleted = library.pendingDeletion {
            ToastView(message: "已刪除「\(deleted.displayTitle)」", actionTitle: "復原") {
                library.undoDeletion()
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        } else if let toast {
            ToastView(message: toast)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private func show(toast message: String) {
        withAnimation { toast = message }
        Task {
            try? await Task.sleep(for: .seconds(2.5))
            withAnimation { if toast == message { toast = nil } }
        }
    }
}

struct ToastView: View {
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            Text(message)
                .font(.subheadline)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Palette.accentStrong)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 44)
                    .background(Palette.accentTint, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .foregroundStyle(Palette.inverseInk)
        .padding(.leading, 16)
        .padding(.trailing, actionTitle == nil ? 16 : 6)
        .frame(minHeight: 56)
        .background(Palette.inverse, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: Palette.shadow, radius: 16, y: 8)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .accessibilityElement(children: .contain)
    }
}

/// 長按時的大預覽
struct LinkPreview: View {
    let item: LinkItem

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if item.image != nil {
                RemoteImage(url: item.image, maxPixel: 800)
                    .frame(width: 340, height: 180)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(item.displayTitle)
                    .font(.headline)
                    .foregroundStyle(Palette.ink)
                    .lineLimit(3)
                if let description = item.description {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(Palette.ink2)
                        .lineLimit(3)
                }
                Text(([item.host, item.createdAt.formatted(date: .abbreviated, time: .shortened)] + item.tags).joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(Palette.ink3)
                    .lineLimit(1)
            }
            .padding(16)
        }
        .frame(width: 340, alignment: .leading)
        .background(Palette.surface)
    }
}
