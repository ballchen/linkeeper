import Foundation
import LinkKeeperKit
import UniformTypeIdentifiers

/// 從分享內容取出網址與頁面資訊。
/// 優先順序：Safari 的 JS 前處理結果（含 og）> 網址 > 文字裡的網址。
@MainActor
enum ShareInput {
    struct Result {
        let url: URL
        let hints: MetadataHints
    }

    static func extract(from items: [NSExtensionItem]) async -> Result? {
        let providers = items.flatMap { $0.attachments ?? [] }

        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier) {
            if let result = await loadPreprocessingResult(provider) { return result }
        }

        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            if let url = await loadURL(provider) {
                return Result(url: url, hints: MetadataHints(title: textTitle(items, excluding: url)))
            }
        }

        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            if let text = await loadText(provider), let url = URLExtraction.firstURL(in: text) {
                return Result(url: url, hints: MetadataHints())
            }
        }

        // 有些 App 只放在 attributedContentText
        for item in items {
            if let text = item.attributedContentText?.string, let url = URLExtraction.firstURL(in: text) {
                return Result(url: url, hints: MetadataHints())
            }
        }
        return nil
    }

    /// 部分 App 分享網址時會把頁面標題放在 attributedContentText
    private static func textTitle(_ items: [NSExtensionItem], excluding url: URL) -> String? {
        let text = items.compactMap { $0.attributedContentText?.string }.first?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let text, !text.isEmpty, URLExtraction.firstURL(in: text) == nil, text.count <= 300 else { return nil }
        return text
    }

    private static func loadPreprocessingResult(_ provider: NSItemProvider) async -> Result? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.propertyList.identifier, options: nil) { @Sendable item, _ in
                guard let dictionary = item as? NSDictionary,
                      let results = dictionary[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any],
                      let urlString = results["url"] as? String,
                      let url = URL(string: urlString), URLExtraction.isHTTP(url) else {
                    continuation.resume(returning: nil)
                    return
                }
                let image = (results["image"] as? String).flatMap { URL(string: $0) }.flatMap { URLExtraction.isHTTP($0) ? $0 : nil }
                continuation.resume(returning: Result(
                    url: url,
                    hints: MetadataHints(
                        title: (results["title"] as? String).map { String($0.prefix(300)) },
                        description: (results["description"] as? String).map { String($0.prefix(1000)) },
                        image: image.flatMap { $0.absoluteString.count <= 2048 ? $0 : nil }
                    )
                ))
            }
        }
    }

    private static func loadURL(_ provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { @Sendable item, _ in
                let url: URL? = switch item {
                case let url as URL: url
                case let string as String: URL(string: string)
                case let data as Data: URL(dataRepresentation: data, relativeTo: nil)
                default: nil
                }
                continuation.resume(returning: url.flatMap { URLExtraction.isHTTP($0) ? $0 : nil })
            }
        }
    }

    private static func loadText(_ provider: NSItemProvider) async -> String? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { @Sendable item, _ in
                let text: String? = switch item {
                case let string as String: string
                case let data as Data: String(data: data, encoding: .utf8)
                case let attributed as NSAttributedString: attributed.string
                default: nil
                }
                continuation.resume(returning: text)
            }
        }
    }
}
