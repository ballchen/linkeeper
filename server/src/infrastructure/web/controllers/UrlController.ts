import { Request, Response } from 'express';
import { AddUrlUseCase } from '../../../application/use-cases/AddUrlUseCase';
import { GetUrlsUseCase } from '../../../application/use-cases/GetUrlsUseCase';
import { DeleteUrlUseCase } from '../../../application/use-cases/DeleteUrlUseCase';
import { UpdateUrlTagsUseCase } from '../../../application/use-cases/UpdateUrlTagsUseCase';
import { RefreshUrlUseCase } from '../../../application/use-cases/RefreshUrlUseCase';
import { Url } from '../../../domain/entities/Url';
import { S3ImageService } from '../../services/S3ImageService';
import { AuthenticatedRequest } from '../../../middleware/jwtAuth';
import { MAX_TAGS, MAX_TAG_LENGTH, parseMetadataHints, parseTags, resolveInputUrl } from '../requestParsing';

export class UrlController {
  constructor(
    private readonly addUrlUseCase: AddUrlUseCase,
    private readonly getUrlsUseCase: GetUrlsUseCase,
    private readonly deleteUrlUseCase: DeleteUrlUseCase,
    private readonly updateUrlTagsUseCase: UpdateUrlTagsUseCase,
    private readonly refreshUrlUseCase: RefreshUrlUseCase,
    private readonly s3ImageService: S3ImageService
  ) {}

  /** dualAuth 的兩種路徑（JWT / API key）都會設定 req.user */
  private getRequesterEmail(req: Request): string | null {
    const email = (req as AuthenticatedRequest).user?.email;
    return email ? email.toLowerCase() : null;
  }

  private rejectUnauthenticated(res: Response): void {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Requester identity is missing'
    });
  }

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

  private async toResponse(url: Url) {
    return {
      _id: url.id,
      url: url.url,
      title: url.metadata.title,
      description: url.metadata.description,
      image: await this.getImageUrl(url.metadata.image || ''),
      source: url.metadata.source,
      tags: url.metadata.tags || [],
      status: url.status,
      createdAt: url.createdAt
    };
  }

  async addUrl(req: Request, res: Response): Promise<void> {
    try {
      const ownerEmail = this.getRequesterEmail(req);
      if (!ownerEmail) {
        this.rejectUnauthenticated(res);
        return;
      }

      const { url: rawUrl, text, tags, metadata } = req.body ?? {};

      const url = resolveInputUrl(rawUrl, text);
      if (!url) {
        res.status(400).json({
          error: 'URL is required',
          message: 'Please provide a valid URL (url) or text containing a URL (text) in the request body'
        });
        return;
      }

      const parsedTags = tags === undefined ? [] : parseTags(tags);
      if (!parsedTags) {
        res.status(400).json({
          error: 'Invalid tags format',
          message: `Tags must be an array of at most ${MAX_TAGS} strings, each up to ${MAX_TAG_LENGTH} characters`
        });
        return;
      }

      const result = await this.addUrlUseCase.execute({
        url,
        tags: parsedTags,
        ownerEmail,
        hints: parseMetadataHints(metadata)
      });

      // 新連結回 201（status: pending，metadata 背景處理中）；已存在回 200
      const statusCode = result.isNew ? 201 : 200;
      const body = await this.toResponse(result.url);
      res.status(statusCode).json({
        ...body,
        id: body._id,
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
      const ownerEmail = this.getRequesterEmail(req);
      if (!ownerEmail) {
        this.rejectUnauthenticated(res);
        return;
      }

      // Check if pagination parameters are provided
      const { limit, cursor, search, source, tags } = req.query;

      // If any pagination parameters are provided, use paginated response
      if (limit || cursor || search || source || tags) {
        await this.getUrlsPaginated(req, res);
        return;
      }

      // Legacy response for backward compatibility
      const result = await this.getUrlsUseCase.execute(ownerEmail);

      // Convert S3 keys to actual URLs for all URLs
      const urls = await Promise.all(result.urls.map(url => this.toResponse(url)));

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
      const ownerEmail = this.getRequesterEmail(req);
      if (!ownerEmail) {
        this.rejectUnauthenticated(res);
        return;
      }

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

      if (sortBy !== 'createdAt') {
        res.status(400).json({
          error: 'Invalid sortBy',
          message: 'Only sorting by createdAt is supported'
        });
        return;
      }

      if (order !== 'desc' && order !== 'asc') {
        res.status(400).json({
          error: 'Invalid order',
          message: 'Order must be either asc or desc'
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
        ownerEmail,
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
      const urls = await Promise.all(result.data.map(url => this.toResponse(url)));

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

  async updateTags(req: Request, res: Response): Promise<void> {
    try {
      const ownerEmail = this.getRequesterEmail(req);
      if (!ownerEmail) {
        this.rejectUnauthenticated(res);
        return;
      }

      const tags = parseTags(req.body?.tags);
      if (!tags) {
        res.status(400).json({
          error: 'Invalid tags format',
          message: `Tags must be an array of at most ${MAX_TAGS} strings, each up to ${MAX_TAG_LENGTH} characters`
        });
        return;
      }

      const url = await this.updateUrlTagsUseCase.execute(req.params.id, ownerEmail, tags);
      res.status(200).json(await this.toResponse(url));
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
        message: 'An unexpected error occurred while updating tags'
      });
    }
  }

  async refreshUrl(req: Request, res: Response): Promise<void> {
    try {
      const ownerEmail = this.getRequesterEmail(req);
      if (!ownerEmail) {
        this.rejectUnauthenticated(res);
        return;
      }

      await this.refreshUrlUseCase.execute(req.params.id, ownerEmail);
      res.status(202).json({ success: true, status: 'pending' });
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
        message: 'An unexpected error occurred while refreshing the URL'
      });
    }
  }

  async deleteUrl(req: Request, res: Response): Promise<void> {
    try {
      const ownerEmail = this.getRequesterEmail(req);
      if (!ownerEmail) {
        this.rejectUnauthenticated(res);
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'URL ID is required',
          message: 'Please provide a valid URL ID'
        });
        return;
      }

      await this.deleteUrlUseCase.execute(id, ownerEmail);

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