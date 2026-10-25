import Foundation

public enum APIError: Error, LocalizedError, Sendable {
    /// 401 / 403：device token 被移除，或帳號不在允許名單
    case unauthorized
    case notFound
    /// 連不上 server（離線、逾時），適合排入佇列稍後重送
    case offline
    case server(status: Int, message: String?)
    case invalidResponse

    public var errorDescription: String? {
        switch self {
        case .unauthorized: "登入已失效，請重新登入"
        case .notFound: "找不到這個連結"
        case .offline: "目前連不上網路"
        case .server(_, let message): message ?? "伺服器發生錯誤"
        case .invalidResponse: "伺服器回應格式不正確"
        }
    }

    /// 稍後重送有機會成功
    public var isRetryable: Bool {
        switch self {
        case .offline: true
        case .server(let status, _): status >= 500 || status == 429
        default: false
        }
    }
}

public struct AddLinkResult: Sendable {
    public let item: LinkItem
    public let isNew: Bool
}

public struct LinkPage: Sendable {
    public let items: [LinkItem]
    public let nextCursor: String?
}

public struct LoginResult: Sendable {
    public let jwt: String
    public let profile: UserProfile
}

public struct IssuedDevice: Sendable {
    public let token: String
    public let device: Device
}

/// LinkKeeper server API。連結相關的請求用 device token；裝置管理只能用 JWT（server 規定）。
public final class APIClient: Sendable {
    public static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let credentials: CredentialStore

    public init(baseURL: URL = AppConfig.apiBaseURL, session: URLSession? = nil, credentials: CredentialStore = .shared) {
        self.baseURL = baseURL
        self.credentials = credentials
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 15
            configuration.waitsForConnectivity = false
            self.session = URLSession(configuration: configuration)
        }
    }

    // MARK: Links

    public func addLink(_ url: URL, hints: MetadataHints, tags: [String] = [], timeout: TimeInterval? = nil) async throws -> AddLinkResult {
        var request = try deviceRequest("urls", method: "POST")
        if let timeout { request.timeoutInterval = timeout }
        request.httpBody = try Self.encoder.encode(AddLinkBody(url: url, hints: hints, tags: tags))
        let response: AddLinkResponse = try await send(request)
        return AddLinkResult(item: response.item, isNew: response.isNew)
    }

    /// 給背景 URLSession 用的請求（Share Extension 離線時交給系統補送）
    public func addLinkRequest(for share: PendingShare) throws -> URLRequest {
        var request = try deviceRequest("urls", method: "POST")
        request.httpBody = try Self.encoder.encode(AddLinkBody(url: share.url, hints: share.hints, tags: share.tags))
        return request
    }

    public func listLinks(cursor: String? = nil, search: String? = nil, source: String? = nil, limit: Int = 30) async throws -> LinkPage {
        var query = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        if let search, !search.isEmpty { query.append(URLQueryItem(name: "search", value: search)) }
        if let source { query.append(URLQueryItem(name: "source", value: source)) }
        let request = try deviceRequest("urls", query: query)
        let response: ListResponse = try await send(request)
        return LinkPage(items: response.data, nextCursor: response.pagination.hasMore ? response.pagination.nextCursor : nil)
    }

    public func updateTags(id: String, tags: [String]) async throws -> LinkItem {
        var request = try deviceRequest("urls/\(id)", method: "PATCH")
        request.httpBody = try Self.encoder.encode(["tags": tags])
        return try await send(request)
    }

    public func deleteLink(id: String) async throws {
        let request = try deviceRequest("urls/\(id)", method: "DELETE")
        let _: SuccessResponse = try await send(request)
    }

    public func refreshLink(id: String) async throws {
        let request = try deviceRequest("urls/\(id)/refresh", method: "POST")
        let _: SuccessResponse = try await send(request)
    }

    // MARK: Auth

    public func loginWithGoogle(idToken: String) async throws -> LoginResult {
        var request = makeRequest("auth/google", method: "POST")
        request.httpBody = try Self.encoder.encode(["idToken": idToken])
        let response: LoginResponse = try await send(request)
        return LoginResult(
            jwt: response.token,
            profile: UserProfile(email: response.user.email, name: response.user.name, picture: response.user.picture.flatMap { URL(string: $0) })
        )
    }

    public func issueDeviceToken(jwt: String, deviceName: String) async throws -> IssuedDevice {
        var request = makeRequest("auth/devices", method: "POST", bearer: jwt)
        request.httpBody = try Self.encoder.encode(["name": deviceName])
        let response: IssueDeviceResponse = try await send(request)
        return IssuedDevice(token: response.token, device: response.device)
    }

    public func listDevices(jwt: String) async throws -> [Device] {
        let response: DevicesResponse = try await send(makeRequest("auth/devices", bearer: jwt))
        return response.devices
    }

    public func revokeDevice(id: String, jwt: String) async throws {
        let _: SuccessResponse = try await send(makeRequest("auth/devices/\(id)", method: "DELETE", bearer: jwt))
    }

    // MARK: Plumbing

    private func deviceRequest(_ path: String, method: String = "GET", query: [URLQueryItem] = []) throws -> URLRequest {
        guard let token = credentials.deviceToken else { throw APIError.unauthorized }
        return makeRequest(path, method: method, query: query, bearer: token)
    }

    private func makeRequest(_ path: String, method: String = "GET", query: [URLQueryItem] = [], bearer: String? = nil) -> URLRequest {
        var url = baseURL.appending(path: path)
        if !query.isEmpty { url.append(queryItems: query) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if method != "GET" { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        return request
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code != .cancelled {
            throw APIError.offline
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        switch http.statusCode {
        case 200..<300:
            do {
                return try Self.decoder.decode(T.self, from: data)
            } catch {
                throw APIError.invalidResponse
            }
        case 401, 403:
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        default:
            let message = (try? Self.decoder.decode(ErrorResponse.self, from: data))?.message
            throw APIError.server(status: http.statusCode, message: message)
        }
    }

    static let encoder = JSONEncoder()

    public static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(value) {
                return date
            }
            if let date = try? Date.ISO8601FormatStyle().parse(value) {
                return date
            }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "無法解析日期 \(value)"))
        }
        return decoder
    }()
}

// MARK: Wire formats

private struct AddLinkBody: Encodable {
    let url: URL
    let hints: MetadataHints
    let tags: [String]

    enum CodingKeys: String, CodingKey { case url, tags, metadata }
    enum MetadataKeys: String, CodingKey { case title, description, image }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(url.absoluteString, forKey: .url)
        if !tags.isEmpty { try c.encode(tags, forKey: .tags) }
        if !hints.isEmpty {
            var m = c.nestedContainer(keyedBy: MetadataKeys.self, forKey: .metadata)
            try m.encodeIfPresent(hints.title, forKey: .title)
            try m.encodeIfPresent(hints.description, forKey: .description)
            try m.encodeIfPresent(hints.image?.absoluteString, forKey: .image)
        }
    }
}

private struct AddLinkResponse: Decodable {
    let item: LinkItem
    let isNew: Bool

    enum CodingKeys: String, CodingKey { case isNew }

    init(from decoder: Decoder) throws {
        item = try LinkItem(from: decoder)
        isNew = try decoder.container(keyedBy: CodingKeys.self).decodeIfPresent(Bool.self, forKey: .isNew) ?? true
    }
}

private struct ListResponse: Decodable {
    struct Pagination: Decodable {
        let hasMore: Bool
        let nextCursor: String?
    }
    let data: [LinkItem]
    let pagination: Pagination
}

private struct LoginResponse: Decodable {
    struct User: Decodable {
        let email: String
        let name: String
        let picture: String?
    }
    let token: String
    let user: User
}

private struct IssueDeviceResponse: Decodable {
    let token: String
    let device: Device
}

private struct DevicesResponse: Decodable {
    let devices: [Device]
}

private struct SuccessResponse: Decodable {}

private struct ErrorResponse: Decodable {
    let message: String?
}
