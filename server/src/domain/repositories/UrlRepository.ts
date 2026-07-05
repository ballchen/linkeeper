import { Url } from '../entities/Url';

export interface UrlQueryParams {
  ownerEmail: string;
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
  findByUrl(url: string, ownerEmail: string): Promise<Url | null>;
  /** ownerEmail 未提供時回傳所有資料（僅供維運 script 使用） */
  findAll(ownerEmail?: string): Promise<Url[]>;
  findWithPagination(params: UrlQueryParams): Promise<PaginatedResult<Url>>;
  findById(id: string): Promise<Url | null>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  update(url: Url): Promise<Url>;
} 