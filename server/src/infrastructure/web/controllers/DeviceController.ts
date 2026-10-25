import { Response } from 'express';
import { DeviceTokenUseCase } from '../../../application/use-cases/DeviceTokenUseCase';
import { DeviceToken } from '../../../domain/entities/DeviceToken';
import { AuthenticatedRequest } from '../../../middleware/jwtAuth';
import logger from '../../../utils/logger';

const MAX_DEVICE_NAME_LENGTH = 100;

const toDeviceResponse = (device: DeviceToken) => ({
  id: device.id,
  name: device.name,
  createdAt: device.createdAt,
  lastUsedAt: device.lastUsedAt
});

export class DeviceController {
  constructor(private readonly deviceTokenUseCase: DeviceTokenUseCase) {}

  /**
   * POST /api/auth/devices
   * Issue a long-lived device token (requires JWT). The token is only returned once.
   */
  async createDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const { name } = req.body ?? {};
      if (name !== undefined && typeof name !== 'string') {
        res.status(400).json({ error: 'Bad Request', message: 'Device name must be a string' });
        return;
      }

      const deviceName = (name || 'iOS device').trim().slice(0, MAX_DEVICE_NAME_LENGTH) || 'iOS device';
      const { token, device } = await this.deviceTokenUseCase.issue(req.user.email, deviceName);

      res.status(201).json({
        success: true,
        token,
        device: toDeviceResponse(device)
      });
    } catch (error) {
      logger.error(`Create device token error: ${error}`);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create device token' });
    }
  }

  /**
   * GET /api/auth/devices
   */
  async listDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const devices = await this.deviceTokenUseCase.list(req.user.email);
      res.status(200).json({ success: true, devices: devices.map(toDeviceResponse) });
    } catch (error) {
      logger.error(`List device tokens error: ${error}`);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list devices' });
    }
  }

  /**
   * DELETE /api/auth/devices/:id
   */
  async revokeDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const revoked = await this.deviceTokenUseCase.revoke(req.params.id, req.user.email);
      if (!revoked) {
        res.status(404).json({ error: 'Not Found', message: 'Device not found' });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error(`Revoke device token error: ${error}`);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to revoke device' });
    }
  }
}
