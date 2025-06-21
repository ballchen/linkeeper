import { Request, Response } from 'express';
import { AuthUseCase } from '../../../application/use-cases/AuthUseCase';
import { AuthenticatedRequest } from '../../../middleware/jwtAuth';
import logger from '../../../utils/logger';

export class AuthController {
  constructor(private authUseCase: AuthUseCase) {}

  /**
   * POST /api/auth/google
   * Authenticate user with Google ID token
   */
  async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Google ID token is required'
        });
        return;
      }

      if (typeof idToken !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Google ID token must be a string'
        });
        return;
      }

      const result = await this.authUseCase.loginWithGoogle(idToken);

      logger.info(`Successful Google login for: ${result.user.email} (New user: ${result.isNewUser})`);

      res.status(200).json({
        success: true,
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          picture: result.user.picture,
          lastLoginAt: result.user.lastLoginAt
        },
        isNewUser: result.isNewUser
      });

    } catch (error) {
      if (error instanceof Error) {
        // Handle known errors
        if (error.message.includes('not authorized')) {
          res.status(403).json({
            error: 'Forbidden',
            message: error.message
          });
          return;
        }

        if (error.message.includes('Invalid')) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid Google ID token provided'
          });
          return;
        }

        logger.error(`Google login error: ${error.message}`);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authentication failed. Please try again.'
        });
        return;
      }

      logger.error(`Unknown Google login error: ${error}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication failed due to server error'
      });
    }
  }

  /**
   * GET /api/auth/profile
   * Get current user profile (requires JWT authentication)
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
        return;
      }

      const user = await this.authUseCase.getUserById(req.user.id);

      if (!user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      logger.error(`Get profile error: ${error}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user profile'
      });
    }
  }

  /**
   * POST /api/auth/verify
   * Verify JWT token validity
   */
  async verifyToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Token is invalid'
        });
        return;
      }

      res.status(200).json({
        success: true,
        valid: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name
        }
      });

    } catch (error) {
      logger.error(`Token verification error: ${error}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Token verification failed'
      });
    }
  }

  /**
   * GET /api/auth/config
   * Get public authentication configuration
   */
  async getAuthConfig(req: Request, res: Response): Promise<void> {
    try {
      const googleClientId = process.env.GOOGLE_CLIENT_ID;

      if (!googleClientId) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Google authentication is not configured'
        });
        return;
      }

      res.status(200).json({
        success: true,
        config: {
          googleClientId,
          authRequired: true
        }
      });

    } catch (error) {
      logger.error(`Get auth config error: ${error}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve authentication configuration'
      });
    }
  }
} 