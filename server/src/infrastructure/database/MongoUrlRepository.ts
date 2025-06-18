import mongoose, { Document, Schema } from 'mongoose';
import { Url, UrlMetadata } from '../../domain/entities/Url';
import { UrlRepository } from '../../domain/repositories/UrlRepository';
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
  createdAt: { type: Date, default: Date.now }
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
    const urlDoc = await UrlModel.findOne({ url });
    return urlDoc ? this.mapToEntity(urlDoc) : null;
  }

  async findAll(): Promise<Url[]> {
    const urlDocs = await UrlModel.find().sort({ createdAt: -1 });
    return urlDocs.map(doc => this.mapToEntity(doc));
  }

  async findById(id: string): Promise<Url | null> {
    const urlDoc = await UrlModel.findById(id);
    return urlDoc ? this.mapToEntity(urlDoc) : null;
  }

  async delete(id: string): Promise<void> {
    await UrlModel.findByIdAndDelete(id);
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