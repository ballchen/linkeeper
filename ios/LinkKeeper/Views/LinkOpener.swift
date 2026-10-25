import LinkKeeperKit
import SafariServices
import SwiftUI

/// 點卡片直接開原文：有對應 App（YouTube、IG⋯）就用 App 開，否則在 App 內用 Safari 開
@MainActor
@Observable
final class LinkOpener {
    var safariURL: IdentifiableURL?

    struct IdentifiableURL: Identifiable {
        let url: URL
        var id: URL { url }
    }

    func open(_ url: URL) {
        Task {
            let opened = await UIApplication.shared.open(url, options: [.universalLinksOnly: true])
            if !opened { safariURL = IdentifiableURL(url: url) }
        }
    }

    func openInSafari(_ url: URL) {
        safariURL = IdentifiableURL(url: url)
    }
}

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.preferredControlTintColor = UIColor(Palette.accent)
        controller.dismissButtonStyle = .close
        return controller
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
