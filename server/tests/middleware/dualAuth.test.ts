import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDualAuth } from '../../src/middleware/dualAuth';
import { DeviceTokenUseCase } from '../../src/application/use-cases/DeviceTokenUseCase';
import { generateJWT } from '../../src/middleware/jwtAuth';
import { InMemoryDeviceTokenRepository } from '../helpers/InMemoryDeviceTokenRepository';
import { mockRequest, mockResponse } from '../helpers/http';

const OWNER = 'me@example.com';

describe('dualAuth', () => {
  let deviceTokens: DeviceTokenUseCase;
  let auth: ReturnType<typeof createDualAuth>;

  /** middleware 可能是 async（device token），等到 next 或回應為止 */
  const run = async (headers: Record<string, string>) => {
    const req = mockRequest({ headers });
    const res = mockResponse();
    const next = vi.fn();
    auth(req, res, next);
    await vi.waitFor(() => {
      if (!next.mock.calls.length && !(res.json as any).mock.calls.length) throw new Error('pending');
    });
    return { req, res, next };
  };

  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-secret');
    vi.stubEnv('ALLOWED_EMAILS', `${OWNER}, second@example.com`);
    vi.stubEnv('INTERNAL_API_KEY', 'bot-key');
    vi.stubEnv('BOT_OWNER_EMAIL', '');
    deviceTokens = new DeviceTokenUseCase(new InMemoryDeviceTokenRepository());
    auth = createDualAuth(deviceTokens);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects requests without credentials', async () => {
    const { res, next } = await run({});
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  describe('API key (Telegram bot)', () => {
    it('accepts the internal key and attributes data to the first allowed email', async () => {
      const { req, next } = await run({ 'x-api-key': 'bot-key' });
      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ id: 'telegram-bot', email: OWNER });
    });

    it('prefers BOT_OWNER_EMAIL when set', async () => {
      vi.stubEnv('BOT_OWNER_EMAIL', 'Second@Example.com');
      const { req } = await run({ 'x-api-key': 'bot-key' });
      expect(req.user?.email).toBe('second@example.com');
    });

    it('rejects a wrong key', async () => {
      const { res, next } = await run({ 'x-api-key': 'wrong' });
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });
  });

  describe('device token (iOS app)', () => {
    it('accepts an active device token', async () => {
      const { token, device } = await deviceTokens.issue(OWNER, 'iPhone');
      const { req, next } = await run({ authorization: `Bearer ${token}` });
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({ id: `device:${device.id}`, email: OWNER, name: 'iPhone' });
    });

    it('rejects a revoked device token', async () => {
      const { token, device } = await deviceTokens.issue(OWNER, 'iPhone');
      await deviceTokens.revoke(device.id, OWNER);
      const { res, next } = await run({ authorization: `Bearer ${token}` });
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('rejects tokens whose owner was removed from ALLOWED_EMAILS', async () => {
      const { token } = await deviceTokens.issue('second@example.com', 'iPhone');
      vi.stubEnv('ALLOWED_EMAILS', OWNER);
      const { res, next } = await run({ authorization: `Bearer ${token}` });
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('returns 500 when the token store fails', async () => {
      vi.spyOn(deviceTokens, 'authenticate').mockRejectedValueOnce(new Error('db down'));
      const { res, next } = await run({ authorization: 'Bearer lkd_anything' });
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(500);
    });
  });

  describe('JWT (web)', () => {
    it('accepts a valid JWT for an allowed email', async () => {
      const token = generateJWT({ id: 'u1', email: OWNER, name: 'Me' });
      const { req, next } = await run({ authorization: `Bearer ${token}` });
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({ id: 'u1', email: OWNER, name: 'Me' });
    });

    it('rejects a JWT for an email that is not allowed', async () => {
      const token = generateJWT({ id: 'u2', email: 'stranger@example.com', name: 'X' });
      const { res } = await run({ authorization: `Bearer ${token}` });
      expect(res.statusCode).toBe(403);
    });

    it('rejects expired and forged JWTs', async () => {
      const expired = jwt.sign({ id: 'u1', email: OWNER, name: 'Me' }, 'test-secret', { expiresIn: -10 });
      expect((await run({ authorization: `Bearer ${expired}` })).res.statusCode).toBe(401);

      const forged = jwt.sign({ id: 'u1', email: OWNER, name: 'Me' }, 'other-secret');
      expect((await run({ authorization: `Bearer ${forged}` })).res.statusCode).toBe(401);
    });

    it('rejects everyone when ALLOWED_EMAILS is empty (fail closed)', async () => {
      const token = generateJWT({ id: 'u1', email: OWNER, name: 'Me' });
      vi.stubEnv('ALLOWED_EMAILS', '');
      expect((await run({ authorization: `Bearer ${token}` })).res.statusCode).toBe(403);
    });
  });
});
