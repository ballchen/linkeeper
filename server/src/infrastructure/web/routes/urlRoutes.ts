import express from 'express';
import { UrlController } from '../controllers/UrlController';
import { validateApiKey } from '../../../middleware/apiKeyAuth';
import { dualAuth } from '../../../middleware/dualAuth';

export function createUrlRoutes(urlController: UrlController): express.Router {
  const router = express.Router();

  // Protected route - accessible with API key (Telegram bot) or JWT (frontend)
  router.post('/', dualAuth, (req, res) => urlController.addUrl(req, res));
  
  // Legacy public route for backward compatibility - will be deprecated
  router.post('/add', (req, res) => urlController.addUrlPublic(req, res));
  
  // Protected route - accessible with API key (Telegram bot) or JWT (frontend)
  router.get('/', dualAuth, (req, res) => urlController.getUrls(req, res));

  return router;
} 