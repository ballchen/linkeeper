import { Url, UrlStatus } from '../../src/domain/entities/Url';
import {
  DuplicateUrlError,
  EnrichedMetadata,
  PaginatedResult,
  UrlQueryParams,
  UrlRepository
} from '../../src/domain/repositories/UrlRepository';

/** 行為對齊 MongoUrlRepository 的記憶體版本（含唯一索引與軟刪除） */
export class InMemoryUrlRepository implements UrlRepository {
  readonly rows = new Map<string, { url: Url; deleted: boolean }>();
  private nextId = 1;

  private active(): Url[] {
    return [...this.rows.values()].filter(row => !row.deleted).map(row => row.url);
  }

  private ownedBy(url: Url, ownerEmail: string): boolean {
    return url.ownerEmail === ownerEmail || url.ownerEmail === null;
  }

  async save(url: Url): Promise<Url> {
    if (this.active().some(existing => existing.url === url.url && existing.ownerEmail === url.ownerEmail)) {
      throw new DuplicateUrlError(url.url);
    }
    const id = String(this.nextId++);
    const saved = new Url(id, url.url, url.metadata, url.createdAt, url.ownerEmail, url.status);
    this.rows.set(id, { url: saved, deleted: false });
    return saved;
  }

  async findByUrl(url: string, ownerEmail: string): Promise<Url | null> {
    return this.active().find(existing => existing.url === url && this.ownedBy(existing, ownerEmail)) ?? null;
  }

  async findAll(ownerEmail?: string): Promise<Url[]> {
    return this.active().filter(url => !ownerEmail || this.ownedBy(url, ownerEmail));
  }

  async findWithPagination(params: UrlQueryParams): Promise<PaginatedResult<Url>> {
    const data = await this.findAll(params.ownerEmail);
    return { data, pagination: { hasMore: false, count: data.length } };
  }

  async findById(id: string): Promise<Url | null> {
    const row = this.rows.get(id);
    return row && !row.deleted ? row.url : null;
  }

  async findByStatus(status: UrlStatus): Promise<Url[]> {
    return this.active().filter(url => url.status === status);
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async softDelete(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.deleted = true;
  }

  async update(url: Url): Promise<Url> {
    const row = this.rows.get(url.id);
    if (!row) throw new Error(`URL with id ${url.id} not found`);
    row.url = url;
    return url;
  }

  async updateEnrichment(id: string, metadata: EnrichedMetadata, status: UrlStatus): Promise<void> {
    const row = this.rows.get(id);
    if (!row) return;
    // 與 Mongo $set 相同：undefined 的欄位不覆蓋
    const defined = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
    row.url = row.url.updateMetadata(defined).withStatus(status);
  }

  async updateTags(id: string, tags: string[]): Promise<Url | null> {
    const row = this.rows.get(id);
    if (!row || row.deleted) return null;
    row.url = row.url.updateMetadata({ tags });
    return row.url;
  }
}
