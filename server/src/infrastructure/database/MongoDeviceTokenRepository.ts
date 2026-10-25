import mongoose, { Document, Schema } from 'mongoose';
import { DeviceToken } from '../../domain/entities/DeviceToken';
import { DeviceTokenRepository } from '../../domain/repositories/DeviceTokenRepository';

interface DeviceTokenDocument extends Document {
  _id: mongoose.Types.ObjectId;
  ownerEmail: string;
  name: string;
  tokenHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

const deviceTokenSchema = new Schema<DeviceTokenDocument>({
  ownerEmail: { type: String, required: true, index: true },
  name: { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null }
});

const DeviceTokenModel = mongoose.model<DeviceTokenDocument>('DeviceToken', deviceTokenSchema);

export class MongoDeviceTokenRepository implements DeviceTokenRepository {
  async save(token: DeviceToken): Promise<DeviceToken> {
    const doc = await new DeviceTokenModel({
      ownerEmail: token.ownerEmail,
      name: token.name,
      tokenHash: token.tokenHash,
      createdAt: token.createdAt
    }).save();
    return this.mapToEntity(doc);
  }

  async findActiveByHash(tokenHash: string): Promise<DeviceToken | null> {
    const doc = await DeviceTokenModel.findOne({ tokenHash, revokedAt: null });
    return doc ? this.mapToEntity(doc) : null;
  }

  async findActiveByOwner(ownerEmail: string): Promise<DeviceToken[]> {
    const docs = await DeviceTokenModel.find({ ownerEmail, revokedAt: null }).sort({ createdAt: -1 });
    return docs.map(doc => this.mapToEntity(doc));
  }

  async touch(id: string, usedAt: Date): Promise<void> {
    await DeviceTokenModel.updateOne({ _id: id }, { $set: { lastUsedAt: usedAt } });
  }

  async revoke(id: string, ownerEmail: string): Promise<boolean> {
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await DeviceTokenModel.updateOne(
      { _id: id, ownerEmail, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  private mapToEntity(doc: DeviceTokenDocument): DeviceToken {
    return new DeviceToken(
      doc._id.toString(),
      doc.ownerEmail,
      doc.name,
      doc.tokenHash,
      doc.createdAt,
      doc.lastUsedAt ?? null,
      doc.revokedAt ?? null
    );
  }
}
