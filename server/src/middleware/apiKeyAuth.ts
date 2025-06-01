import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  isAuthenticated?: boolean;
}

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

    if (providedApiKey !== expectedApiKey) {
      logger.warn(`Invalid API key in request to ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key provided.'
      });
      return;
    }

    // Mark request as authenticated
    req.isAuthenticated = true;
    logger.info(`Authenticated request to ${req.path} from IP: ${req.ip}`);
    
    next();
  } catch (error) {
    logger.error(`API key validation error: ${error}`);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed due to server error'
    });
  }
}; 