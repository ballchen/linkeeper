import { randomBytes, createHash } from 'crypto';
import { DeviceToken } from '../../domain/entities/DeviceToken';
import { DeviceTokenRepository } from '../../domain/repositories/DeviceTokenRepository';
import logger from '../../utils/logger';

/* 前綴讓 dualAuth 能分辨 device token 與 JWT，也方便在 log / secret scanner 中辨識 */
export const DEVICE_TOKEN_PREFIX = 'lkd_';

/* lastUsedAt 不需要每個請求都寫入 */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export interface IssuedDeviceToken {
  token: string;
  device: DeviceToken;
}

export class DeviceTokenUseCase {
  constructor(private readonly deviceTokenRepository: DeviceTokenRepository) {}

  /** 明文 token 只在建立時回傳一次 */
  async issue(ownerEmail: string, name: string): Promise<IssuedDeviceToken> {
    const token = DEVICE_TOKEN_PREFIX + randomBytes(32).toString('base64url');
    const device = await this.deviceTokenRepository.save(
      DeviceToken.create(ownerEmail.toLowerCase(), name, hashToken(token))
    );
    logger.info(`Device token issued for ${device.ownerEmail}: ${device.name} (${device.id})`);
    return { token, device };
  }

  async authenticate(token: string): Promise<DeviceToken | null> {
    if (!token.startsWith(DEVICE_TOKEN_PREFIX)) return null;

    const device = await this.deviceTokenRepository.findActiveByHash(hashToken(token));
    if (!device) return null;

    const now = new Date();
    if (!device.lastUsedAt || now.getTime() - device.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      this.deviceTokenRepository.touch(device.id, now).catch(error => {
        logger.warn(`Failed to update lastUsedAt for device ${device.id}: ${error}`);
      });
    }

    return device;
  }

  async list(ownerEmail: string): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.findActiveByOwner(ownerEmail.toLowerCase());
  }

  async revoke(id: string, ownerEmail: string): Promise<boolean> {
    const revoked = await this.deviceTokenRepository.revoke(id, ownerEmail.toLowerCase());
    if (revoked) {
      logger.info(`Device token revoked by ${ownerEmail}: ${id}`);
    }
    return revoked;
  }
}
