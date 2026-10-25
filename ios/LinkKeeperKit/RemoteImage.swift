import SwiftUI
import UIKit

/// 縮圖載入與快取。S3 的 presigned URL 每次 query 都不同，快取 key 不含 query。
@MainActor
final class ImageCache {
    static let shared = ImageCache()

    private let memory = NSCache<NSString, UIImage>()
    private let session: URLSession
    private var inflight: [String: Task<UIImage?, Never>] = [:]

    private init() {
        memory.countLimit = 300
        let configuration = URLSessionConfiguration.default
        configuration.urlCache = URLCache(memoryCapacity: 8 << 20, diskCapacity: 150 << 20)
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        session = URLSession(configuration: configuration)
    }

    static func key(for url: URL) -> String {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        components?.query = nil
        return components?.string ?? url.absoluteString
    }

    func cached(_ url: URL) -> UIImage? {
        memory.object(forKey: Self.key(for: url) as NSString)
    }

    func load(_ url: URL, maxPixel: CGFloat) async -> UIImage? {
        let key = Self.key(for: url)
        if let image = memory.object(forKey: key as NSString) { return image }
        if let task = inflight[key] { return await task.value }

        let session = session
        let task = Task<UIImage?, Never> {
            guard let (data, _) = try? await session.data(from: url) else { return nil }
            return await Task.detached { Self.downsample(data, maxPixel: maxPixel) }.value
        }
        inflight[key] = task
        let image = await task.value
        inflight[key] = nil
        if let image { memory.setObject(image, forKey: key as NSString) }
        return image
    }

    nonisolated private static func downsample(_ data: Data, maxPixel: CGFloat) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

public struct RemoteImage: View {
    private let url: URL?
    private let maxPixel: CGFloat
    @State private var image: UIImage?
    @State private var failed = false

    public init(url: URL?, maxPixel: CGFloat = 300) {
        self.url = url
        self.maxPixel = maxPixel
        _image = State(initialValue: url.flatMap { ImageCache.shared.cached($0) })
    }

    public var body: some View {
        ZStack {
            Palette.bgDeep
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else if url == nil || failed {
                Image(systemName: "link")
                    .font(.title3)
                    .foregroundStyle(Palette.ink3)
            }
        }
        .clipped()
        .task(id: url) {
            guard let url, image == nil else { return }
            let loaded = await ImageCache.shared.load(url, maxPixel: maxPixel)
            withAnimation(.easeOut(duration: 0.2)) {
                image = loaded
                failed = loaded == nil
            }
        }
        .accessibilityHidden(true)
    }
}

/// 處理中的閃動佔位
public struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init() {}

    public func body(content: Content) -> some View {
        content
            .overlay {
                if !reduceMotion {
                    GeometryReader { proxy in
                        LinearGradient(
                            colors: [.clear, Palette.surface.opacity(0.55), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: proxy.size.width * 0.8)
                        .offset(x: phase * proxy.size.width * 1.4)
                    }
                    .clipped()
                }
            }
            .onAppear {
                withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { phase = 1 }
            }
    }
}

extension View {
    public func shimmering() -> some View { modifier(Shimmer()) }
}
