import mongoose, { Document, Schema } from 'mongoose';
import { Url, UrlMetadata, UrlStatus } from '../../domain/entities/Url';
import { UrlRepository, UrlQueryParams, PaginatedResult, DuplicateUrlError, EnrichedMetadata } from '../../domain/repositories/UrlRepository';
import { UrlSource } from '../../domain/services/UrlAnalysisService';

interface UrlDocument extends Document {
  _id: mongoose.Types.ObjectId;
  url: string;
  ownerEmail?: string | null;
  title?: string;
  description?: string;
  image?: string;
  imageSourceUrl?: string;
  source?: UrlSource;
  tags?: string[];
  status?: UrlStatus;
  createdAt: Date;
  deletedAt?: Date;
}

const UrlSchema: Schema = new Schema({
  url: { type: String, required: true },
  // null 代表尚未遷移的舊資料（見 scripts/migrateOwnership.ts）
  ownerEmail: { type: String, default: null, index: true },
  title: { type: String },
  description: { type: String },
  image: { type: String },
  imageSourceUrl: { type: String },
  source: {
    type: String,
    enum: ['facebook', 'instagram', 'threads', 'youtube'],
    required: false
  },
  tags: [{ type: String }],
  // 舊資料沒有此欄位，mapToEntity 視為 ready
  status: { type: String, enum: ['pending', 'ready', 'failed'], default: 'ready', index: true },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null }
});

// 同一使用者的有效連結不可重複；deletedAt 納入索引讓軟刪除後可重新收藏
// 注意：舊的 url_1 唯一索引需由 migration script 移除
UrlSchema.index({ url: 1, ownerEmail: 1, deletedAt: 1 }, { unique: true });

const UrlModel = mongoose.model<UrlDocument>('Url', UrlSchema);

/* 讓使用者輸入可安全地放進 $regex */
const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* 過濾條件同時涵蓋本人資料與尚未遷移的舊資料（ownerEmail: null） */
const ownerFilter = (ownerEmail: string) => ({ $in: [ownerEmail, null] });

export class MongoUrlRepository implements UrlRepository {
  async save(url: Url): Promise<Url> {
    const urlDoc = new UrlModel({
      url: url.url,
      ownerEmail: url.ownerEmail,
      title: url.metadata.title,
      description: url.metadata.description,
      image: url.metadata.image,
      imageSourceUrl: url.metadata.imageSourceUrl,
      source: url.metadata.source,
      tags: url.metadata.tags || [],
      status: url.status,
      createdAt: url.createdAt
    });

    try {
      const savedDoc = await urlDoc.save();
      return this.mapToEntity(savedDoc);
    } catch (error) {
      // 併發的重複請求（例如分享時重送）撞到唯一索引
      if ((error as { code?: number }).code === 11000) {
        throw new DuplicateUrlError(url.url);
      }
      throw error;
    }
  }

  async updateEnrichment(id: string, metadata: EnrichedMetadata, status: UrlStatus): Promise<void> {
    // 只更新 metadata 欄位，避免覆蓋處理期間使用者修改的 tags
    await UrlModel.updateOne(
      { _id: id },
      { $set: { ...metadata, status } }
    );
  }

  async updateTags(id: string, tags: string[]): Promise<Url | null> {
    const updatedDoc = await UrlModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { tags } },
      { new: true }
    );
    return updatedDoc ? this.mapToEntity(updatedDoc) : null;
  }

  async findByStatus(status: UrlStatus): Promise<Url[]> {
    const urlDocs = await UrlModel.find({ status, deletedAt: null }).sort({ createdAt: 1 });
    return urlDocs.map(doc => this.mapToEntity(doc));
  }

  async findByUrl(url: string, ownerEmail: string): Promise<Url | null> {
    const urlDoc = await UrlModel.findOne({ url, ownerEmail: ownerFilter(ownerEmail), deletedAt: null });
    return urlDoc ? this.mapToEntity(urlDoc) : null;
  }

  async findAll(ownerEmail?: string): Promise<Url[]> {
    const query: Record<string, unknown> = { deletedAt: null };
    if (ownerEmail) {
      query.ownerEmail = ownerFilter(ownerEmail);
    }
    const urlDocs = await UrlModel.find(query).sort({ createdAt: -1 });
    return urlDocs.map(doc => this.mapToEntity(doc));
  }

  async findWithPagination(params: UrlQueryParams): Promise<PaginatedResult<Url>> {
    const {
      ownerEmail,
      limit = 50,
      cursor,
      sortBy = 'createdAt',
      order = 'desc',
      search,
      source,
      tags
    } = params;

    // Build query
    const query: any = { deletedAt: null, ownerEmail: ownerFilter(ownerEmail) };

    // Cursor-based pagination using _id
    if (cursor) {
      try {
        query._id = order === 'desc'
          ? { $lt: new mongoose.Types.ObjectId(cursor) }
          : { $gt: new mongoose.Types.ObjectId(cursor) };
      } catch (error) {
        throw new Error('Invalid cursor format');
      }
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { url: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // 'other' 表示沒有辨識出來源的一般網站
    if (source === 'other') {
      query.source = null;
    } else if (source) {
      query.source = source;
    }

    // Tags filter (for future)
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    // Sort configuration
    const sortConfig: any = {};
    sortConfig[sortBy] = order === 'desc' ? -1 : 1;
    sortConfig._id = order === 'desc' ? -1 : 1; // Secondary sort by _id for consistency

    // Fetch one extra to check if there are more results
    const urlDocs = await UrlModel
      .find(query)
      .sort(sortConfig)
      .limit(limit + 1);

    // Check if there are more results
    const hasMore = urlDocs.length > limit;
    if (hasMore) {
      urlDocs.pop(); // Remove the extra document
    }

    // Get next cursor
    const nextCursor = urlDocs.length > 0 && hasMore
      ? urlDocs[urlDocs.length - 1]._id.toString()
      : undefined;

    const urls = urlDocs.map(doc => this.mapToEntity(doc));

    return {
      data: urls,
      pagination: {
        hasMore,
        nextCursor,
        count: urls.length
      }
    };
  }

  async findById(id: string): Promise<Url | null> {
    // 格式不正確的 id 會讓 mongoose 丟 CastError（變成 500），直接視為找不到
    if (!mongoose.isValidObjectId(id)) return null;
    const urlDoc = await UrlModel.findOne({ _id: id, deletedAt: null });
    return urlDoc ? this.mapToEntity(urlDoc) : null;
  }

  async delete(id: string): Promise<void> {
    await UrlModel.findByIdAndDelete(id);
  }

  async softDelete(id: string): Promise<void> {
    await UrlModel.findByIdAndUpdate(id, {
      deletedAt: new Date()
    });
  }

  async update(url: Url): Promise<Url> {
    const updatedDoc = await UrlModel.findByIdAndUpdate(
      url.id,
      {
        url: url.url,
        title: url.metadata.title,
        description: url.metadata.description,
        image: url.metadata.image,
        source: url.metadata.source,
        tags: url.metadata.tags || [],
        status: url.status
      },
      { new: true }
    );

    if (!updatedDoc) {
      throw new Error(`URL with id ${url.id} not found`);
    }

    return this.mapToEntity(updatedDoc);
  }

  private mapToEntity(doc: UrlDocument): Url {
    const metadata: UrlMetadata = {
      title: doc.title,
      description: doc.description,
      image: doc.image,
      imageSourceUrl: doc.imageSourceUrl,
      source: doc.source,
      tags: doc.tags || []
    };

    return new Url(
      doc._id.toString(),
      doc.url,
      metadata,
      doc.createdAt,
      doc.ownerEmail ?? null,
      doc.status ?? 'ready'
    );
  }
} 