import SwiftUI
import UIKit

/// 與網頁版 client/src/index.css 相同的色票（淺色 / 深色）
public enum Palette {
    public static let bg = dynamic(0xF6F2EA, 0x17130D)
    public static let bgDeep = dynamic(0xEEE8DA, 0x100D08)
    public static let surface = dynamic(0xFFFDF8, 0x221C12)
    public static let ink = dynamic(0x211C14, 0xF0E9D8)
    public static let ink2 = dynamic(0x5C5442, 0xC6BCA4)
    public static let ink3 = dynamic(0x8B8069, 0x94896E)
    public static let line = dynamic(0xE3DBC9, 0x362F1F)
    public static let lineStrong = dynamic(0xCFC5AD, 0x4A4229)
    public static let accent = dynamic(0xB0501A, 0xE0763A)
    public static let accentStrong = dynamic(0x93400F, 0xEA8B55)
    public static let accentInk = dynamic(0xFFF8EF, 0x1C1207)
    public static let accentTint = dynamic(0xF2E2D2, 0x3A2A19)
    public static let danger = dynamic(0xB3372C, 0xE06A5D)
    public static let dangerTint = dynamic(0xF6E0DC, 0x3D221E)
    public static let success = dynamic(0x3F6F4F, 0x7CAB8B)
    public static let successTint = dynamic(0xE0EBE0, 0x1F2E23)
    /// 深色的 toast / 主要按鈕底色，深色模式下反白
    public static let inverse = dynamic(0x211C14, 0xF0E9D8)
    public static let inverseInk = dynamic(0xFFFDF8, 0x17130D)

    public static let shadow = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor.black.withAlphaComponent(0.45) : UIColor(rgb: 0x3E3018, alpha: 0.16)
    })

    public static func sourceColor(_ source: LinkSource?) -> Color {
        switch source {
        case .youtube: Color(uiColor: UIColor(rgb: 0xC4302B))
        case .instagram: Color(uiColor: UIColor(rgb: 0xC13584))
        case .facebook: Color(uiColor: UIColor(rgb: 0x1877F2))
        case .threads: ink
        case nil: ink3
        }
    }

    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(rgb: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: alpha
        )
    }
}

extension Font {
    /// 網頁版用 Fraunces / Noto Serif TC；iOS 用系統內建襯線字（New York），支援動態字級
    public static func display(_ style: Font.TextStyle, weight: Font.Weight = .bold) -> Font {
        .system(style, design: .serif, weight: weight)
    }
}

public struct PrimaryButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.bold))
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundStyle(Palette.inverseInk)
            .background(Palette.inverse, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

public struct SecondaryButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.medium))
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundStyle(Palette.ink)
            .background(Palette.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

public enum Haptics {
    @MainActor public static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    @MainActor public static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }

    @MainActor public static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
