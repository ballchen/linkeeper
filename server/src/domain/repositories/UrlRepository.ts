import { Url, UrlMetadata, UrlStatus } from '../entities/Url';

export type EnrichedMetadata = Pick<UrlMetadata, 'title' | 'description' | 'image'>;

export class DuplicateUrlError extends Error {
  constructor(url: string) {
    super(`URL already saved: ${url}`);
    this.name = 'DuplicateUrlError';
  }
}

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
  /** 同一使用者重複的有效連結會丟出 DuplicateUrlError */
  save(url: Url): Promise<Url>;
  findByUrl(url: string, ownerEmail: string): Promise<Url | null>;
  /** ownerEmail 未提供時回傳所有資料（僅供維運 script 使用） */
  findAll(ownerEmail?: string): Promise<Url[]>;
  findWithPagination(params: UrlQueryParams): Promise<PaginatedResult<Url>>;
  findById(id: string): Promise<Url | null>;
  /** 跨使用者查詢，供背景 metadata 處理使用 */
  findByStatus(status: UrlStatus): Promise<Url[]>;
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  update(url: Url): Promise<Url>;
  /** 背景處理完成時寫回 metadata；不動 tags */
  updateEnrichment(id: string, metadata: EnrichedMetadata, status: UrlStatus): Promise<void>;
  /** 找不到（或已刪除）時回傳 null */
  updateTags(id: string, tags: string[]): Promise<Url | null>;
} 