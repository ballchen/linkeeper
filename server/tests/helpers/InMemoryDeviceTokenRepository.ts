import { DeviceToken } from '../../src/domain/entities/DeviceToken';
import { DeviceTokenRepository } from '../../src/domain/repositories/DeviceTokenRepository';

export class InMemoryDeviceTokenRepository implements DeviceTokenRepository {
  readonly rows = new Map<string, DeviceToken>();
  private nextId = 1;

  async save(token: DeviceToken): Promise<DeviceToken> {
    const id = String(this.nextId++);
    const saved = new DeviceToken(id, token.ownerEmail, token.name, token.tokenHash, token.createdAt);
    this.rows.set(id, saved);
    return saved;
  }

  async findActiveByHash(tokenHash: string): Promise<DeviceToken | null> {
    return [...this.rows.values()].find(token => token.tokenHash === tokenHash && !token.revokedAt) ?? null;
  }

  async findActiveByOwner(ownerEmail: string): Promise<DeviceToken[]> {
    return [...this.rows.values()].filter(token => token.ownerEmail === ownerEmail && !token.revokedAt);
  }

  async touch(id: string, usedAt: Date): Promise<void> {
    const t = this.rows.get(id);
    if (t) this.rows.set(id, new DeviceToken(t.id, t.ownerEmail, t.name, t.tokenHash, t.createdAt, usedAt, t.revokedAt));
  }

  async revoke(id: string, ownerEmail: string): Promise<boolean> {
    const t = this.rows.get(id);
    if (!t || t.ownerEmail !== ownerEmail || t.revokedAt) return false;
    this.rows.set(id, new DeviceToken(t.id, t.ownerEmail, t.name, t.tokenHash, t.createdAt, t.lastUsedAt, new Date()));
    return true;
  }
}
