import mongoose, { Document, Schema } from 'mongoose';
import { User } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';

interface UserDocument extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  picture?: string;
  lastLoginAt: Date;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  picture: { type: String },
  lastLoginAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.model<UserDocument>('User', userSchema);

export class MongoUserRepository implements UserRepository {
  async save(user: User): Promise<User> {
    const userDoc = new UserModel({
      email: user.email,
      name: user.name,
      picture: user.picture,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    });

    const savedDoc = await userDoc.save();
    return this.mapToEntity(savedDoc);
  }

  async findByEmail(email: string): Promise<User | null> {
    const userDoc = await UserModel.findOne({ email });
    return userDoc ? this.mapToEntity(userDoc) : null;
  }

  async findById(id: string): Promise<User | null> {
    const userDoc = await UserModel.findById(id);
    return userDoc ? this.mapToEntity(userDoc) : null;
  }

  async update(user: User): Promise<User> {
    const updatedDoc = await UserModel.findByIdAndUpdate(
      user.id,
      {
        email: user.email,
        name: user.name,
        picture: user.picture,
        lastLoginAt: user.lastLoginAt
      },
      { new: true }
    );

    if (!updatedDoc) {
      throw new Error(`User with id ${user.id} not found`);
    }

    return this.mapToEntity(updatedDoc);
  }

  async delete(id: string): Promise<void> {
    const result = await UserModel.findByIdAndDelete(id);
    if (!result) {
      throw new Error(`User with id ${id} not found`);
    }
  }

  private mapToEntity(doc: UserDocument): User {
    return new User(
      doc._id.toString(),
      doc.email,
      doc.name,
      doc.picture,
      doc.lastLoginAt,
      doc.createdAt
    );
  }
} 