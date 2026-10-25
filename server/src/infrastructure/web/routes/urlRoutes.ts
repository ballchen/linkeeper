import express, { RequestHandler } from 'express';
import { UrlController } from '../controllers/UrlController';

export function createUrlRoutes(urlController: UrlController, dualAuth: RequestHandler): express.Router {
  const router = express.Router();

  // All routes require API key (Telegram bot), device token (iOS app) or JWT (frontend)
  router.post('/', dualAuth, (req, res) => urlController.addUrl(req, res));
  router.get('/', dualAuth, (req, res) => urlController.getUrls(req, res));
  router.patch('/:id', dualAuth, (req, res) => urlController.updateTags(req, res));
  router.post('/:id/refresh', dualAuth, (req, res) => urlController.refreshUrl(req, res));
  router.delete('/:id', dualAuth, (req, res) => urlController.deleteUrl(req, res));

  return router;
}
