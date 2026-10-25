/**
 * 長效、可撤銷的裝置憑證（例如 iOS app 與 Share Extension）。
 * JWT 7 天就過期，Share Extension 在使用者沒開主 app 時無法自行重新登入，
 * 因此登入後換一組 device token 存在 Keychain。DB 只存 token 的 SHA-256。
 */
export class DeviceToken {
  constructor(
    public readonly id: string,
    public readonly ownerEmail: string,
    public readonly name: string,
    public readonly tokenHash: string,
    public readonly createdAt: Date,
    public readonly lastUsedAt: Date | null = null,
    public readonly revokedAt: Date | null = null
  ) {}

  static create(ownerEmail: string, name: string, tokenHash: string): DeviceToken {
    return new DeviceToken('', ownerEmail, name, tokenHash, new Date());
  }
}
