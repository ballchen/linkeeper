import express from 'express';
import { UrlController } from '../controllers/UrlController';
import { validateApiKey } from '../../../middleware/apiKeyAuth';

export function createUrlRoutes(urlController: UrlController): express.Router {
  const router = express.Router();

  // Protected route - only accessible with valid API key (for Telegram bot)
  router.post('/', validateApiKey, (req, res) => urlController.addUrl(req, res));
  
  // Public route - accessible without authentication (for frontend)
  router.get('/', (req, res) => urlController.getUrls(req, res));

  return router;
} 