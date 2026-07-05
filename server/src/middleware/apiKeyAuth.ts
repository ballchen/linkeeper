import { Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import { AuthenticatedRequest, getAllowedEmails } from './jwtAuth';
import logger from '../utils/logger';

export type { AuthenticatedRequest };

/* 先雜湊再比較：長度一致才能用 timingSafeEqual，同時避免長度洩漏 */
const safeCompare = (a: string, b: string): boolean => {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
};

/**
 * API key 請求（Telegram bot）的資料歸屬者：
 * BOT_OWNER_EMAIL 優先，未設定則取 ALLOWED_EMAILS 的第一個
 */
export const getBotOwnerEmail = (): string | null => {
  const explicit = process.env.BOT_OWNER_EMAIL?.trim().toLowerCase();
  if (explicit) return explicit;
  return getAllowedEmails()[0] || null;
};

/**
 * Middleware to validate API key for internal bot requests
 * Expects the API key to be provided in the Authorization header as Bearer token
 * or in the x-api-key header
 */
export const validateApiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const expectedApiKey = process.env.INTERNAL_API_KEY;

    if (!expectedApiKey) {
      logger.error('INTERNAL_API_KEY environment variable is not set');
      res.status(500).json({
        error: 'Server configuration error',
        message: 'API key validation is not properly configured'
      });
      return;
    }

    // Extract API key from Authorization header (Bearer token) or x-api-key header
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    let providedApiKey: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedApiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else if (apiKeyHeader) {
      providedApiKey = apiKeyHeader;
    }

    if (!providedApiKey) {
      logger.warn(`API key missing in request to ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Provide it in Authorization header (Bearer token) or x-api-key header.'
      });
      return;
    }

    if (!safeCompare(providedApiKey, expectedApiKey)) {
      logger.warn(`Invalid API key in request to ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key provided.'
      });
      return;
    }

    const ownerEmail = getBotOwnerEmail();
    if (!ownerEmail) {
      logger.error('Cannot resolve data owner for API key request — set BOT_OWNER_EMAIL or ALLOWED_EMAILS');
      res.status(500).json({
        error: 'Server configuration error',
        message: 'Data ownership is not configured for API key requests.'
      });
      return;
    }

    // Mark request as authenticated and attach the owner identity
    req.isAuthenticated = true;
    req.user = {
      id: 'telegram-bot',
      email: ownerEmail,
      name: 'Telegram Bot'
    };
    logger.info(`Authenticated API key request to ${req.path} from IP: ${req.ip}`);

    next();
  } catch (error) {
    logger.error(`API key validation error: ${error}`);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed due to server error'
    });
  }
};
