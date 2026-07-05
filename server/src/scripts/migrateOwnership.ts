/**
 * 一次性遷移：為既有 URL 資料補上 ownerEmail，並將唯一索引
 * 從 url_1 換成 (url, ownerEmail, deletedAt)。
 *
 * 用法：
 *   npx ts-node src/scripts/migrateOwnership.ts <owner-email>
 *   （未帶參數時依序取 BOT_OWNER_EMAIL、ALLOWED_EMAILS 第一個）
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const resolveOwnerEmail = (): string | null => {
  const fromArg = process.argv[2]?.trim().toLowerCase();
  if (fromArg) return fromArg;

  const fromEnv = process.env.BOT_OWNER_EMAIL?.trim().toLowerCase();
  if (fromEnv) return fromEnv;

  const firstAllowed = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)[0];
  return firstAllowed || null;
};

const run = async (): Promise<void> => {
  const ownerEmail = resolveOwnerEmail();
  if (!ownerEmail || !ownerEmail.includes('@')) {
    console.error('用法：npx ts-node src/scripts/migrateOwnership.ts <owner-email>');
    console.error('或設定 BOT_OWNER_EMAIL / ALLOWED_EMAILS 環境變數。');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/url-saver';
  await mongoose.connect(mongoUri);
  const collection = mongoose.connection.collection('urls');

  console.log(`將所有未歸屬的連結指定給：${ownerEmail}`);
  const backfill = await collection.updateMany(
    { $or: [{ ownerEmail: null }, { ownerEmail: { $exists: false } }] },
    { $set: { ownerEmail } }
  );
  console.log(`已更新 ${backfill.modifiedCount} 筆資料`);

  const ensureDeletedAt = await collection.updateMany(
    { deletedAt: { $exists: false } },
    { $set: { deletedAt: null } }
  );
  console.log(`補齊 deletedAt 欄位：${ensureDeletedAt.modifiedCount} 筆`);

  const indexes = await collection.indexes();
  if (indexes.some(index => index.name === 'url_1')) {
    await collection.dropIndex('url_1');
    console.log('已移除舊的 url_1 唯一索引');
  } else {
    console.log('找不到舊的 url_1 索引（可能已移除）');
  }

  await collection.createIndex(
    { url: 1, ownerEmail: 1, deletedAt: 1 },
    { unique: true }
  );
  console.log('已建立 (url, ownerEmail, deletedAt) 唯一索引');

  await mongoose.disconnect();
  console.log('遷移完成 ✅');
};

run().catch(async (error) => {
  console.error(`遷移失敗：${error}`);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
