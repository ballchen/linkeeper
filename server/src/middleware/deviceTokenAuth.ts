import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, getAllowedEmails } from './jwtAuth';
import { DeviceTokenUseCase } from '../application/use-cases/DeviceTokenUseCase';
import logger from '../utils/logger';

/**
 * 驗證 Authorization: Bearer lkd_... 的 device token（iOS app / Share Extension）
 */
export const createDeviceTokenAuth = (deviceTokenUseCase: DeviceTokenUseCase) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.substring(7) || '';
      const device = await deviceTokenUseCase.authenticate(token);

      if (!device) {
        logger.warn(`Invalid or revoked device token in request to ${req.path} from IP: ${req.ip}`);
        res.status(401).json({
          error: 'Invalid token',
          message: 'Device token is invalid or has been revoked.'
        });
        return;
      }

      // 與 JWT 相同 fail closed：email 從允許清單移除後，既有 device token 一併失效
      if (!getAllowedEmails().includes(device.ownerEmail)) {
        logger.warn(`Device token for non-allowed email ${device.ownerEmail} rejected`);
        res.status(403).json({
          error: 'Forbidden',
          message: 'Your account is not authorized to access this application.'
        });
        return;
      }

      req.isAuthenticated = true;
      req.user = {
        id: `device:${device.id}`,
        email: device.ownerEmail,
        name: device.name
      };

      next();
    } catch (error) {
      logger.error(`Device token validation error: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Authentication failed due to server error'
      });
    }
  };
