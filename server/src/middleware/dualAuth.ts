import { Response, NextFunction } from 'express';
import { validateApiKey } from './apiKeyAuth';
import { validateJWT, AuthenticatedRequest } from './jwtAuth';
import { createDeviceTokenAuth } from './deviceTokenAuth';
import { DeviceTokenUseCase, DEVICE_TOKEN_PREFIX } from '../application/use-cases/DeviceTokenUseCase';
import logger from '../utils/logger';

/**
 * Authentication middleware that accepts API key, device token or JWT
 * For Telegram bot: uses API key authentication
 * For iOS app / Share Extension: uses device token (Bearer lkd_...)
 * For frontend: uses JWT authentication
 */
export const createDualAuth = (deviceTokenUseCase: DeviceTokenUseCase) => {
  const validateDeviceToken = createDeviceTokenAuth(deviceTokenUseCase);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Check if API key is provided (for Telegram bot)
    const apiKey = req.headers['x-api-key'];

    if (apiKey) {
      // Use API key authentication for Telegram bot
      logger.info(`API key authentication attempt for ${req.path}`);
      validateApiKey(req, res, next);
      return;
    }

    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith(`Bearer ${DEVICE_TOKEN_PREFIX}`)) {
      logger.info(`Device token authentication attempt for ${req.path}`);
      validateDeviceToken(req, res, next);
      return;
    }

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
      message: 'Authentication required. Provide an API key (X-API-Key header), device token or JWT (Authorization: Bearer header).'
    });
  };
};
