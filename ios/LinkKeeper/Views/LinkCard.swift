import LinkKeeperKit
import SwiftUI

struct LinkCard: View {
    let item: LinkItem
    var onRefetch: () -> Void = {}

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
            VStack(alignment: .leading, spacing: 6) {
                title
                meta
                if !item.tags.isEmpty {
                    FlowLayout(spacing: 4) {
                        ForEach(item.tags, id: \.self) { TagChip($0) }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(Palette.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: Palette.shadow.opacity(0.35), radius: 1, y: 1)
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    @ViewBuilder
    private var thumbnail: some View {
        Group {
            if item.status == .pending && item.image == nil {
                Palette.bgDeep.shimmering()
            } else {
                RemoteImage(url: item.image, maxPixel: 240)
            }
        }
        .frame(width: 76, height: 76)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    @ViewBuilder
    private var title: some View {
        if item.status == .pending && item.title == nil {
            Text("正在抓取標題⋯")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Palette.ink3)
        } else {
            Text(item.displayTitle)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Palette.ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
    }

    private var meta: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Palette.sourceColor(item.source))
                .frame(width: 7, height: 7)
            Text(item.source?.displayName ?? item.host)
                .lineLimit(1)
            Text("·")
            Text(Self.timeLabel(item.createdAt))
                .lineLimit(1)
            if item.status == .failed && item.title == nil {
                Spacer(minLength: 4)
                Button("重新抓取", action: onRefetch)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Palette.accentStrong)
                    .buttonStyle(.borderless)
                    .frame(minHeight: 28)
            }
        }
        .font(.caption)
        .foregroundStyle(Palette.ink3)
    }

    /// 一小時內用「12 分鐘前」，今天用時間，更早只顯示時間（日期在區段標題）
    static func timeLabel(_ date: Date) -> String {
        if date.timeIntervalSinceNow > -3600 {
            return date.formatted(.relative(presentation: .named, unitsStyle: .abbreviated))
        }
        return date.formatted(date: .omitted, time: .shortened)
    }
}

struct SourceFilterBar: View {
    @Binding var selection: SourceFilter

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(SourceFilter.allCases) { filter in
                    let selected = filter == selection
                    Button {
                        Haptics.tap()
                        selection = filter
                    } label: {
                        Text(filter.title)
                            .font(.subheadline.weight(selected ? .bold : .medium))
                            .padding(.horizontal, 14)
                            .frame(minHeight: 34)
                            .foregroundStyle(selected ? Palette.inverseInk : Palette.ink)
                            .background(selected ? Palette.inverse : Palette.surface, in: Capsule())
                            .overlay { if !selected { Capsule().strokeBorder(Palette.line) } }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.horizontal, 16)
        }
    }
}
