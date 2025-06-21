import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validateJWT } from '../../../middleware/jwtAuth';

export const createAuthRoutes = (authController: AuthController): Router => {
  const router = Router();

  // Public routes (no authentication required)
  router.post('/google', authController.googleLogin.bind(authController));
  router.get('/config', authController.getAuthConfig.bind(authController));

  // Protected routes (JWT authentication required)
  router.get('/profile', validateJWT, authController.getProfile.bind(authController));
  router.post('/verify', validateJWT, authController.verifyToken.bind(authController));

  return router;
}; 