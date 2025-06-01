import { Request, Response } from 'express';
import { AddUrlUseCase } from '../../../application/use-cases/AddUrlUseCase';
import { GetUrlsUseCase } from '../../../application/use-cases/GetUrlsUseCase';
import { AddUrlSchema } from '../schemas/addUrlSchema';
import { ZodIssue } from 'zod';

export class UrlController {
  constructor(
    private readonly addUrlUseCase: AddUrlUseCase,
    private readonly getUrlsUseCase: GetUrlsUseCase
  ) {}

  async addUrl(req: Request, res: Response): Promise<void> {
    try {
      const parsed = AddUrlSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid request data',
          message: parsed.error.errors.map((e: ZodIssue) => e.message).join(', ')
        });
        return;
      }

      const { url, tags } = parsed.data;

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