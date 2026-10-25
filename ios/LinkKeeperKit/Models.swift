import Foundation

public enum LinkSource: String, Codable, CaseIterable, Sendable {
    case youtube, instagram, facebook, threads

    public var displayName: String {
        switch self {
        case .youtube: "YouTube"
        case .instagram: "Instagram"
        case .facebook: "Facebook"
        case .threads: "Threads"
        }
    }
}

public enum LinkStatus: String, Codable, Sendable {
    case pending, ready, failed
}

/// server 回傳的連結（GET /api/urls、POST /api/urls）
public struct LinkItem: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var url: URL
    public var title: String?
    public var description: String?
    public var image: URL?
    public var source: LinkSource?
    public var tags: [String]
    public var status: LinkStatus
    public var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id = "_id", url, title, description, image, source, tags, status, createdAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        url = try c.decode(URL.self, forKey: .url)
        title = try c.decodeIfPresent(String.self, forKey: .title).nonEmpty
        description = try c.decodeIfPresent(String.self, forKey: .description).nonEmpty
        // server 沒有圖片時回傳空字串
        image = try c.decodeIfPresent(String.self, forKey: .image).nonEmpty.flatMap { URL(string: $0) }
        source = try? c.decodeIfPresent(LinkSource.self, forKey: .source)
        tags = try c.decodeIfPresent([String].self, forKey: .tags) ?? []
        status = (try? c.decodeIfPresent(LinkStatus.self, forKey: .status)) ?? .ready
        createdAt = try c.decode(Date.self, forKey: .createdAt)
    }

    public var host: String {
        url.host(percentEncoded: false).map { $0.hasPrefix("www.") ? String($0.dropFirst(4)) : $0 } ?? url.absoluteString
    }

    public var displayTitle: String { title ?? host }
}

/// 從分享內容取得的頁面資訊（Safari 的 og tags），送給 server 當提示
public struct MetadataHints: Codable, Hashable, Sendable {
    public var title: String?
    public var description: String?
    public var image: URL?

    public init(title: String? = nil, description: String? = nil, image: URL? = nil) {
        self.title = title.nonEmpty
        self.description = description.nonEmpty
        self.image = image
    }

    public var isEmpty: Bool { title == nil && description == nil && image == nil }
}

/// 尚未確認送達 server 的分享；存在 App Group，App 與 Share Extension 都會補送
public struct PendingShare: Codable, Identifiable, Hashable, Sendable {
    public let id: UUID
    public var url: URL
    public var hints: MetadataHints
    public var tags: [String]
    public var createdAt: Date
    public var attempts: Int

    public init(url: URL, hints: MetadataHints, tags: [String] = []) {
        id = UUID()
        self.url = url
        self.hints = hints
        self.tags = tags
        createdAt = Date()
        attempts = 0
    }
}

public struct UserProfile: Codable, Hashable, Sendable {
    public var email: String
    public var name: String
    public var picture: URL?

    public init(email: String, name: String, picture: URL?) {
        self.email = email
        self.name = name
        self.picture = picture
    }
}

public struct Device: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var createdAt: Date
    public var lastUsedAt: Date?
}

extension Optional where Wrapped == String {
    var nonEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}
