import mongoose, { Document, Schema } from 'mongoose';
import { Url, UrlMetadata } from '../../domain/entities/Url';
import { UrlRepository, UrlQueryParams, PaginatedResult } from '../../domain/repositories/UrlRepository';
import { UrlSource } from '../../domain/services/UrlAnalysisService';

interface UrlDocument extends Document {
  _id: mongoose.Types.ObjectId;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  source?: UrlSource;
  tags?: string[];
  createdAt: Date;
  deletedAt?: Date;
}

const UrlSchema: Schema = new Schema({
  url: { type: String, required: true, unique: true },
  title: { type: String },
  description: { type: String },
  image: { type: String },
  source: { 
    type: String, 
    enum: ['facebook', 'instagram', 'threads', 'youtube'],
    required: false 
  },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null }
});

const UrlModel = mongoose.model<UrlDocument>('Url', UrlSchema);

export class MongoUrlRepository implements UrlRepository {
  async save(url: Url): Promise<Url> {
    const urlDoc = new UrlModel({
      url: url.url,
      title: url.metadata.title,
      description: url.metadata.description,
      image: url.metadata.image,
      source: url.metadata.source,
      tags: url.metadata.tags || [],
      createdAt: url.createdAt
    });

    const savedDoc = await urlDoc.save();
    return this.mapToEntity(savedDoc);
  }

  async findByUrl(url: string): Promise<Url | null> {
    const urlDoc = await UrlModel.findOne({ url, deletedAt: null });
    return urlDoc ? this.mapToEntity(urlDoc) : null;
  }

  async findAll(): Promise<Url[]> {
    const urlDocs = await UrlModel.find({ deletedAt: null }).sort({ createdAt: -1 });
    return urlDocs.map(doc => this.mapToEntity(doc));
  }

  async findWithPagination(params: UrlQueryParams): Promise<PaginatedResult<Url>> {
    const {
      limit = 50,
      cursor,
      sortBy = 'createdAt',
      order = 'desc',
      search,
      source,
      tags
    } = params;

    // Build query
    const query: any = { deletedAt: null };

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

    // Search functionality (for future)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { url: { $regex: search, $options: 'i' } }
      ];
    }

    // Source filter (for future)
    if (source) {
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
        tags: url.metadata.tags || []
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
      source: doc.source,
      tags: doc.tags || []
    };

    return new Url(
      doc._id.toString(),
      doc.url,
      metadata,
      doc.createdAt
    );
  }
} 