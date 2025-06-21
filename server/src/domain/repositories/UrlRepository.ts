import { Url } from '../entities/Url';

export interface UrlQueryParams {
  limit?: number;
  cursor?: string;
  sortBy?: 'createdAt';
  order?: 'desc' | 'asc';
  search?: string;
  source?: string;
  tags?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    count: number;
  };
}

export interface UrlRepository {
  save(url: Url): Promise<Url>;
  findByUrl(url: string): Promise<Url | null>;
  findAll(): Promise<Url[]>;
  findWithPagination(params: UrlQueryParams): Promise<PaginatedResult<Url>>;
  findById(id: string): Promise<Url | null>;
  delete(id: string): Promise<void>;
  update(url: Url): Promise<Url>;
} 