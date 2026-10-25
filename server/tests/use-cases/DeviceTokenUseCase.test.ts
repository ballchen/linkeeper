import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_TOKEN_PREFIX, DeviceTokenUseCase } from '../../src/application/use-cases/DeviceTokenUseCase';
import { InMemoryDeviceTokenRepository } from '../helpers/InMemoryDeviceTokenRepository';

describe('DeviceTokenUseCase', () => {
  let repo: InMemoryDeviceTokenRepository;
  let useCase: DeviceTokenUseCase;

  beforeEach(() => {
    repo = new InMemoryDeviceTokenRepository();
    useCase = new DeviceTokenUseCase(repo);
  });

  it('issues a prefixed random token and stores only its SHA-256 hash', async () => {
    const { token, device } = await useCase.issue('Me@Example.com', 'iPhone');

    expect(token.startsWith(DEVICE_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(device.ownerEmail).toBe('me@example.com');
    expect(device.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify([...repo.rows.values()])).not.toContain(token);
  });

  it('issues a different token every time', async () => {
    const a = await useCase.issue('me@example.com', 'a');
    const b = await useCase.issue('me@example.com', 'b');
    expect(a.token).not.toBe(b.token);
  });

  it('authenticates a valid token', async () => {
    const { token, device } = await useCase.issue('me@example.com', 'iPhone');
    expect((await useCase.authenticate(token))?.id).toBe(device.id);
  });

  it('rejects unknown, unprefixed and revoked tokens', async () => {
    const { token, device } = await useCase.issue('me@example.com', 'iPhone');

    expect(await useCase.authenticate(`${DEVICE_TOKEN_PREFIX}unknown`)).toBeNull();
    expect(await useCase.authenticate(token.slice(DEVICE_TOKEN_PREFIX.length))).toBeNull();

    expect(await useCase.revoke(device.id, 'me@example.com')).toBe(true);
    expect(await useCase.authenticate(token)).toBeNull();
  });

  it('only lets the owner revoke a device', async () => {
    const { device } = await useCase.issue('me@example.com', 'iPhone');
    expect(await useCase.revoke(device.id, 'other@example.com')).toBe(false);
    expect(await useCase.revoke('missing', 'me@example.com')).toBe(false);
    expect(await useCase.list('me@example.com')).toHaveLength(1);
  });

  it('lists only active devices of the owner', async () => {
    const { device } = await useCase.issue('me@example.com', 'old');
    await useCase.issue('me@example.com', 'new');
    await useCase.issue('other@example.com', 'theirs');
    await useCase.revoke(device.id, 'me@example.com');

    expect((await useCase.list('ME@example.com')).map(d => d.name)).toEqual(['new']);
  });

  it('updates lastUsedAt at most once per hour', async () => {
    const touch = vi.spyOn(repo, 'touch');
    const { token } = await useCase.issue('me@example.com', 'iPhone');

    await useCase.authenticate(token);
    await useCase.authenticate(token);
    expect(touch).toHaveBeenCalledTimes(1);

    vi.useFakeTimers({ now: Date.now() + 61 * 60 * 1000 });
    try {
      await useCase.authenticate(token);
      expect(touch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still authenticates when updating lastUsedAt fails', async () => {
    vi.spyOn(repo, 'touch').mockRejectedValue(new Error('db down'));
    const { token } = await useCase.issue('me@example.com', 'iPhone');
    expect(await useCase.authenticate(token)).not.toBeNull();
  });
});
