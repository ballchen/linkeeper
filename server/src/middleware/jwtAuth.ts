import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

interface JWTPayload {
  id: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

/**
 * Middleware to validate JWT token for frontend requests
 * Expects the JWT token to be provided in the Authorization header as Bearer token
 */
export const validateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable is not set');
      res.status(500).json({ 
        error: 'Server configuration error',
        message: 'JWT authentication is not properly configured'
      });
      return;
    }

    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`JWT token missing in request to ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'JWT token is required. Provide it in Authorization header as Bearer token.'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      logger.warn(`Empty JWT token in request to ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'JWT token cannot be empty.'
      });
      return;
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Check if the user is in the allowed list
    const allowedEmails = process.env.ALLOWED_EMAILS?.split(',').map(email => email.trim()) || [];
    
    if (allowedEmails.length > 0 && !allowedEmails.includes(decoded.email)) {
      logger.warn(`Unauthorized user attempted access: ${decoded.email} from IP: ${req.ip}`);
      res.status(403).json({
        error: 'Forbidden',
        message: 'Your account is not authorized to access this application.'
      });
      return;
    }

    // Attach user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    };

    logger.info(`Authenticated request to ${req.path} from user: ${decoded.email}`);
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`Expired JWT token in request to ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`Invalid JWT token in request to ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        error: 'Invalid token',
        message: 'Invalid authentication token provided.'
      });
      return;
    }

    logger.error(`JWT validation error: ${error}`);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed due to server error'
    });
  }
};

/**
 * Generate JWT token for authenticated user
 */
export const generateJWT = (user: { id: string; email: string; name: string }): string => {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    jwtSecret,
    {
      expiresIn: '7d' // 7 days as requested
    }
  );
}; 