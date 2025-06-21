import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from './apiKeyAuth';
import { validateJWT, AuthenticatedRequest } from './jwtAuth';
import logger from '../utils/logger';

/**
 * Dual authentication middleware that accepts both API key and JWT
 * For Telegram bot: uses API key authentication
 * For frontend: uses JWT authentication
 */
export const dualAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Check if API key is provided (for Telegram bot)
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    // Use API key authentication for Telegram bot
    logger.info(`API key authentication attempt for ${req.path}`);
    validateApiKey(req, res, next);
    return;
  }

  // Check if JWT token is provided (for frontend)
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Use JWT authentication for frontend
    logger.info(`JWT authentication attempt for ${req.path}`);
    validateJWT(req, res, next);
    return;
  }

  // No authentication method provided
  logger.warn(`No authentication method provided for ${req.path} from IP: ${req.ip}`);
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required. Provide either API key (X-API-Key header) or JWT token (Authorization: Bearer header).'
  });
}; 