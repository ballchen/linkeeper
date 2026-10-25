import { DeviceToken } from '../entities/DeviceToken';

export interface DeviceTokenRepository {
  save(token: DeviceToken): Promise<DeviceToken>;
  /** 只回傳未撤銷的 token */
  findActiveByHash(tokenHash: string): Promise<DeviceToken | null>;
  findActiveByOwner(ownerEmail: string): Promise<DeviceToken[]>;
  touch(id: string, usedAt: Date): Promise<void>;
  /** 找不到或不屬於該使用者時回傳 false */
  revoke(id: string, ownerEmail: string): Promise<boolean>;
}
