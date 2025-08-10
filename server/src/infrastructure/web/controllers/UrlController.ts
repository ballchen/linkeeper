import { Request, Response } from 'express';
import { AddUrlUseCase } from '../../../application/use-cases/AddUrlUseCase';
import { GetUrlsUseCase } from '../../../application/use-cases/GetUrlsUseCase';
import { DeleteUrlUseCase } from '../../../application/use-cases/DeleteUrlUseCase';
import { S3ImageService } from '../../services/S3ImageService';

export class UrlController {
  constructor(
    private readonly addUrlUseCase: AddUrlUseCase,
    private readonly getUrlsUseCase: GetUrlsUseCase,
    private readonly deleteUrlUseCase: DeleteUrlUseCase,
    private readonly s3ImageService: S3ImageService
  ) {}

  private async getImageUrl(s3Key: string): Promise<string> {
    if (!s3Key || s3Key.trim() === '') {
      return '';
    }
    
    try {
      return await this.s3ImageService.getImageUrl(s3Key);
    } catch (error) {
      console.error('Error generating S3 image URL:', error);
      return '';
    }
  }

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

      // Convert S3 key to actual URL
      const imageUrl = await this.getImageUrl(result.url.metadata.image || '');

      const statusCode = result.isNew ? 201 : 200;
      res.status(statusCode).json({
        id: result.url.id,
        url: result.url.url,
        title: result.url.metadata.title,
        description: result.url.metadata.description,
        image: imageUrl,
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

      // Convert S3 key to actual URL
      const imageUrl = await this.getImageUrl(result.url.metadata.image || '');

      res.status(200).json({
        id: result.url.id,
        url: result.url.url,
        title: result.url.metadata.title,
        description: result.url.metadata.description,
        image: imageUrl,
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
      // Check if pagination parameters are provided
      const { limit, cursor, sortBy, order, search, source, tags } = req.query;
      
      // If any pagination parameters are provided, use paginated response
      if (limit || cursor || search || source || tags) {
        await this.getUrlsPaginated(req, res);
        return;
      }

      // Legacy response for backward compatibility
      const result = await this.getUrlsUseCase.execute();

      // Convert S3 keys to actual URLs for all URLs
      const urls = await Promise.all(result.urls.map(async (url) => {
        const imageUrl = await this.getImageUrl(url.metadata.image || '');
        
        return {
          _id: url.id,
          url: url.url,
          title: url.metadata.title,
          description: url.metadata.description,
          image: imageUrl,
          source: url.metadata.source,
          tags: url.metadata.tags || [],
          createdAt: url.createdAt
        };
      }));

      res.status(200).json(urls);
    } catch (error) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching URLs'
      });
    }
  }

  async getUrlsPaginated(req: Request, res: Response): Promise<void> {
    try {
      const { 
        limit = '50', 
        cursor, 
        sortBy = 'createdAt', 
        order = 'desc',
        search,
        source,
        tags
      } = req.query;

      // Validate and parse parameters
      const parsedLimit = parseInt(limit as string, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        res.status(400).json({
          error: 'Invalid limit',
          message: 'Limit must be a number between 1 and 100'
        });
        return;
      }

      // Parse tags if provided
      let parsedTags: string[] | undefined;
      if (tags) {
        if (Array.isArray(tags)) {
          parsedTags = tags as string[];
        } else if (typeof tags === 'string') {
          parsedTags = tags.split(',').map(tag => tag.trim());
        }
      }

      const request = {
        limit: parsedLimit,
        cursor: cursor as string,
        sortBy: sortBy as 'createdAt',
        order: order as 'desc' | 'asc',
        search: search as string,
        source: source as string,
        tags: parsedTags
      };

      const result = await this.getUrlsUseCase.executeWithPagination(request);

      // Convert S3 keys to actual URLs for all URLs
      const urls = await Promise.all(result.data.map(async (url) => {
        const imageUrl = await this.getImageUrl(url.metadata.image || '');
        
        return {
          _id: url.id,
          url: url.url,
          title: url.metadata.title,
          description: url.metadata.description,
          image: imageUrl,
          source: url.metadata.source,
          tags: url.metadata.tags || [],
          createdAt: url.createdAt
        };
      }));

      res.status(200).json({
        data: urls,
        pagination: result.pagination
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid cursor')) {
        res.status(400).json({
          error: 'Invalid cursor',
          message: error.message
        });
        return;
      }

      res.status(500).json({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching URLs'
      });
    }
  }

  async deleteUrl(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'URL ID is required',
          message: 'Please provide a valid URL ID'
        });
        return;
      }

      await this.deleteUrlUseCase.execute(id);

      res.status(200).json({
        success: true,
        message: 'URL deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'URL not found',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while deleting the URL'
      });
    }
  }

} 