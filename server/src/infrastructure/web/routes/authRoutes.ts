import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { DeviceController } from '../controllers/DeviceController';
import { validateJWT } from '../../../middleware/jwtAuth';

export const createAuthRoutes = (authController: AuthController, deviceController: DeviceController): Router => {
  const router = Router();

  // Public routes (no authentication required)
  router.post('/google', authController.googleLogin.bind(authController));
  router.get('/config', authController.getAuthConfig.bind(authController));

  // Protected routes (JWT authentication required)
  router.get('/profile', validateJWT, authController.getProfile.bind(authController));
  router.post('/verify', validateJWT, authController.verifyToken.bind(authController));

  // Device tokens（iOS app / Share Extension）：只能用 JWT 管理，device token 本身不能再簽發新的 token
  router.post('/devices', validateJWT, deviceController.createDevice.bind(deviceController));
  router.get('/devices', validateJWT, deviceController.listDevices.bind(deviceController));
  router.delete('/devices/:id', validateJWT, deviceController.revokeDevice.bind(deviceController));

  return router;
}; 