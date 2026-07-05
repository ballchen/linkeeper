import { Url } from '../../domain/entities/Url';
import { UrlRepository, UrlQueryParams, PaginatedResult } from '../../domain/repositories/UrlRepository';

export interface GetUrlsResponse {
  urls: Url[];
}

export interface GetUrlsPaginatedRequest {
  ownerEmail: string;
  limit?: number;
  cursor?: string;
  sortBy?: 'createdAt';
  order?: 'desc' | 'asc';
  search?: string;
  source?: string;
  tags?: string[];
}

export interface GetUrlsPaginatedResponse {
  data: Url[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    count: number;
  };
}

export class GetUrlsUseCase {
  constructor(private readonly urlRepository: UrlRepository) {}

  async execute(ownerEmail: string): Promise<GetUrlsResponse> {
    const urls = await this.urlRepository.findAll(ownerEmail);

    return {
      urls
    };
  }

  async executeWithPagination(request: GetUrlsPaginatedRequest): Promise<GetUrlsPaginatedResponse> {
    const params: UrlQueryParams = {
      ownerEmail: request.ownerEmail,
      limit: request.limit || 50,
      cursor: request.cursor,
      sortBy: request.sortBy || 'createdAt',
      order: request.order || 'desc',
      search: request.search,
      source: request.source,
      tags: request.tags
    };

    const result = await this.urlRepository.findWithPagination(params);
    
    return {
      data: result.data,
      pagination: result.pagination
    };
  }
} 