import Foundation

/// 補送 App Group 佇列裡的分享。server 依網址去重，所以重送是安全的。
public final class UploadQueue: Sendable {
    public static let shared = UploadQueue()

    public struct DrainResult: Sendable {
        public var uploaded: [LinkItem] = []
        public var remaining = 0
        /// device token 已失效，要重新登入
        public var needsSignIn = false
    }

    private let api: APIClient
    private let store: SharedStore

    public init(api: APIClient = .shared, store: SharedStore = .shared) {
        self.api = api
        self.store = store
    }

    public func drain() async -> DrainResult {
        var result = DrainResult()
        let shares = store.pendingShares()

        for share in shares {
            do {
                let added = try await api.addLink(share.url, hints: share.hints, tags: share.tags)
                // 重複的連結不會套用新標籤，另外補上
                if !added.isNew, !share.tags.isEmpty {
                    let merged = (added.item.tags + share.tags).uniqued()
                    _ = try? await api.updateTags(id: added.item.id, tags: merged)
                }
                store.removePendingShare(id: share.id)
                result.uploaded.append(added.item)
            } catch let error as APIError where error.isRetryable {
                store.updatePendingShares { queue in
                    if let index = queue.firstIndex(where: { $0.id == share.id }) {
                        queue[index].attempts += 1
                    }
                }
                // 連不上就不必繼續試後面的
                break
            } catch APIError.unauthorized {
                result.needsSignIn = true
                break
            } catch {
                // 網址被 server 拒絕之類的永久錯誤：留著也送不出去
                store.removePendingShare(id: share.id)
            }
        }

        result.remaining = store.pendingShares().count
        return result
    }
}
