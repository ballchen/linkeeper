import LinkKeeperKit
import SwiftUI

struct SettingsView: View {
    let library: LibraryStore

    @Environment(SessionModel.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var devices: [Device] = []
    @State private var devicesState: LoadState = .idle
    @State private var deviceToRemove: Device?
    @State private var confirmingSignOut = false
    @State private var isRetrying = false

    private enum LoadState: Equatable {
        case idle, loading, loaded, failed(String)
    }

    var body: some View {
        NavigationStack {
            Form {
                accountSection
                shareSection
                devicesSection
                otherSection

                Section {
                    EmptyView()
                } footer: {
                    Text("LinkKeeper \(AppConfig.appVersion)")
                        .frame(maxWidth: .infinity)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Palette.bg)
            .navigationTitle("設定")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                        .fontWeight(.bold)
                }
            }
            .task { await loadDevices() }
            .confirmationDialog(
                "移除「\(deviceToRemove?.name ?? "")」？",
                isPresented: Binding(get: { deviceToRemove != nil }, set: { if !$0 { deviceToRemove = nil } }),
                titleVisibility: .visible
            ) {
                Button("移除", role: .destructive) {
                    if let device = deviceToRemove { Task { await remove(device) } }
                }
            } message: {
                Text("移除後，該裝置要重新登入才能再分享。")
            }
            .confirmationDialog("要登出嗎？", isPresented: $confirmingSignOut, titleVisibility: .visible) {
                Button("登出", role: .destructive) {
                    Task {
                        library.reset()
                        await session.signOut()
                    }
                }
            } message: {
                Text("這台裝置的分享功能會一起停用。")
            }
        }
        .tint(Palette.accentStrong)
    }

    private var accountSection: some View {
        Section("帳號") {
            if let profile = session.profile {
                HStack(spacing: 12) {
                    Text(String(profile.name.prefix(1)).uppercased())
                        .font(.body.weight(.bold))
                        .foregroundStyle(Palette.accentStrong)
                        .frame(width: 40, height: 40)
                        .background(Palette.accentTint, in: Circle())
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(profile.name)
                            .foregroundStyle(Palette.ink)
                        Text("\(profile.email) · Google")
                            .font(.footnote)
                            .foregroundStyle(Palette.ink3)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .listRowBackground(Palette.surface)
    }

    private var shareSection: some View {
        Section("分享") {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("上傳佇列")
                        .foregroundStyle(Palette.ink)
                    Text(library.pendingShares.isEmpty ? "全部都已上傳" : "\(library.pendingShares.count) 個連結等待網路")
                        .font(.footnote)
                        .foregroundStyle(library.pendingShares.isEmpty ? Palette.success : Palette.ink3)
                }
                Spacer()
                if !library.pendingShares.isEmpty {
                    Button {
                        Task {
                            isRetrying = true
                            await library.refresh()
                            isRetrying = false
                        }
                    } label: {
                        if isRetrying { ProgressView() } else { Text("立即重試") }
                    }
                    .disabled(isRetrying)
                }
            }

            NavigationLink {
                SetupView(finishTitle: "完成") { dismiss() }
                    .navigationBarTitleDisplayMode(.inline)
            } label: {
                Text("把 LinkKeeper 加到分享選單")
                    .foregroundStyle(Palette.ink)
            }
        }
        .listRowBackground(Palette.surface)
    }

    private var devicesSection: some View {
        Section {
            switch devicesState {
            case .idle, .loading:
                HStack {
                    ProgressView()
                    Text("讀取中⋯").foregroundStyle(Palette.ink3)
                }
            case .failed(let message):
                HStack {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(Palette.ink3)
                    Spacer()
                    Button("重試") { Task { await loadDevices() } }
                }
            case .loaded:
                ForEach(devices) { device in
                    deviceRow(device)
                }
            }
        } header: {
            Text("已登入的裝置")
        } footer: {
            Text("移除後，該裝置要重新登入才能再分享。手機遺失時從網頁版也可以移除。")
        }
        .listRowBackground(Palette.surface)
    }

    private func deviceRow(_ device: Device) -> some View {
        let isCurrent = device.id == CredentialStore.shared.deviceId
        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(device.name)
                    .foregroundStyle(Palette.ink)
                Group {
                    if isCurrent {
                        Text("這台裝置").foregroundStyle(Palette.success)
                    } else if let lastUsed = device.lastUsedAt {
                        Text("\(lastUsed.formatted(.relative(presentation: .named)))使用")
                    } else {
                        Text("尚未使用")
                    }
                }
                .font(.footnote)
                .foregroundStyle(Palette.ink3)
            }
            Spacer()
            if !isCurrent {
                Button("移除", role: .destructive) { deviceToRemove = device }
                    .foregroundStyle(Palette.danger)
                    .buttonStyle(.borderless)
            }
        }
    }

    private var otherSection: some View {
        Section("其他") {
            Button {
                openURL(AppConfig.webURL)
            } label: {
                HStack {
                    Text("開啟網頁版").foregroundStyle(Palette.ink)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Palette.ink3)
                }
            }
            Button("登出", role: .destructive) { confirmingSignOut = true }
                .foregroundStyle(Palette.danger)
        }
        .listRowBackground(Palette.surface)
    }

    // MARK: 裝置管理（需要 JWT）

    private func loadDevices() async {
        devicesState = .loading
        do {
            let jwt = try await session.freshJWT()
            let currentId = CredentialStore.shared.deviceId
            // 這台裝置排第一，其餘依登入時間新到舊
            devices = try await APIClient.shared.listDevices(jwt: jwt).sorted { lhs, rhs in
                if (lhs.id == currentId) != (rhs.id == currentId) { return lhs.id == currentId }
                return lhs.createdAt > rhs.createdAt
            }
            devicesState = .loaded
        } catch {
            devicesState = .failed("無法讀取裝置列表")
        }
    }

    private func remove(_ device: Device) async {
        do {
            let jwt = try await session.freshJWT()
            try await APIClient.shared.revokeDevice(id: device.id, jwt: jwt)
            withAnimation { devices.removeAll { $0.id == device.id } }
            Haptics.success()
        } catch {
            devicesState = .failed("移除失敗，請再試一次")
        }
    }
}
