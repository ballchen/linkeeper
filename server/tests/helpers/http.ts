import { vi } from 'vitest';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../src/middleware/jwtAuth';

export const mockRequest = (overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest =>
  ({ headers: {}, body: {}, params: {}, query: {}, path: '/', ip: '127.0.0.1', ...overrides }) as AuthenticatedRequest;

export interface MockResponse extends Response {
  statusCode: number;
  body: any;
}

export const mockResponse = (): MockResponse => {
  const res = { statusCode: 200, body: undefined } as MockResponse;
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; }) as any;
  res.json = vi.fn((body: unknown) => { res.body = body; return res; }) as any;
  return res;
};

export type { Request };
