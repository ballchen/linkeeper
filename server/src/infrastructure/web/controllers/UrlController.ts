import { Request, Response } from 'express';
import { AddUrlUseCase } from '../../../application/use-cases/AddUrlUseCase';
import { GetUrlsUseCase } from '../../../application/use-cases/GetUrlsUseCase';

export class UrlController {
  constructor(
    private readonly addUrlUseCase: AddUrlUseCase,
    private readonly getUrlsUseCase: GetUrlsUseCase
  ) {}

  async addUrl(req: Request, res: Response): Promise<void> {
    try {
      const { url, tags } = req.body;

      if (!url) {
        res.status(400).json({ 
          error: 'URL is required',
          message: 'Please provide a valid URL in the request body'
        });
        return;
      }

      // Validate tags if provided
      if (tags && !Array.isArray(tags)) {
        res.status(400).json({
          error: 'Invalid tags format',
          message: 'Tags must be an array of strings'
        });
        return;
      }

      if (Array.isArray(tags) && !tags.every(tag => typeof tag === 'string')) {
        res.status(400).json({
          error: 'Invalid tags format',
          message: 'Tags must be an array of strings'
        });
        return;
      }

      const result = await this.addUrlUseCase.execute({ url, tags });

      const statusCode = result.isNew ? 201 : 200;
      res.status(statusCode).json({
        id: result.url.id,
        url: result.url.url,
        title: result.url.metadata.title,
        description: result.url.metadata.description,
        image: result.url.metadata.image,
        source: result.url.metadata.source,
        tags: result.url.metadata.tags || [],
        createdAt: result.url.createdAt,
        isNew: result.isNew
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid URL')) {
        res.status(400).json({ 
          error: 'Invalid URL',
          message: error.message
        });
        return;
      }

      res.status(500).json({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      });
    }
  }

  async addUrlPublic(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.body;

      if (!url) {
        res.status(400).json({ 
          error: 'URL is required',
          message: 'Please provide a valid URL in the request body'
        });
        return;
      }

      const result = await this.addUrlUseCase.execute({ url });

      res.status(200).json({
        id: result.url.id,
        url: result.url.url,
        title: result.url.metadata.title,
        description: result.url.metadata.description,
        image: result.url.metadata.image,
        source: result.url.metadata.source,
        tags: result.url.metadata.tags || [],
        createdAt: result.url.createdAt,
        isNew: result.isNew
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid URL')) {
        res.status(400).json({ 
          error: 'Invalid URL',
          message: error.message
        });
        return;
      }

      res.status(500).json({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      });
    }
  }

  async getUrls(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.getUrlsUseCase.execute();

      const urls = result.urls.map(url => ({
        id: url.id,
        url: url.url,
        title: url.metadata.title,
        description: url.metadata.description,
        image: url.metadata.image,
        source: url.metadata.source,
        tags: url.metadata.tags || [],
        createdAt: url.createdAt
      }));

      res.status(200).json(urls);
    } catch (error) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching URLs'
      });
    }
  }
} 