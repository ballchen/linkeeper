import Foundation

public enum URLExtraction {
    /// 從分享的文字中找出第一個 http(s) 網址（例如「看這個 https://… 超讚」）
    public static func firstURL(in text: String) -> URL? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed), isHTTP(url) {
            return url
        }
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return nil }
        let range = NSRange(trimmed.startIndex..., in: trimmed)
        return detector.matches(in: trimmed, range: range)
            .compactMap(\.url)
            .first(where: isHTTP)
    }

    public static func isHTTP(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), url.host() != nil else { return false }
        return scheme == "http" || scheme == "https"
    }
}

extension Array where Element: Hashable {
    public func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

public enum TagRules {
    // 與 server 的 parseTags 一致
    public static let maxTags = 20
    public static let maxLength = 50

    public static func normalize(_ tag: String) -> String? {
        let value = tag.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        return String(value.prefix(maxLength))
    }
}
