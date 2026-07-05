import express from 'express';
import { UrlController } from '../controllers/UrlController';
import { dualAuth } from '../../../middleware/dualAuth';

export function createUrlRoutes(urlController: UrlController): express.Router {
  const router = express.Router();

  // All routes require API key (Telegram bot) or JWT (frontend)
  router.post('/', dualAuth, (req, res) => urlController.addUrl(req, res));
  router.get('/', dualAuth, (req, res) => urlController.getUrls(req, res));
  router.delete('/:id', dualAuth, (req, res) => urlController.deleteUrl(req, res));

  return router;
}
