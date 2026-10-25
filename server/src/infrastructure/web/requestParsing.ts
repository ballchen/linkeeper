import { MetadataHints } from '../../application/use-cases/AddUrlUseCase';
import { extractUrlFromText, isHttpUrl } from '../../utils/urlNormalize';

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

const MAX_HINT_TITLE_LENGTH = 300;
const MAX_HINT_DESCRIPTION_LENGTH = 1000;
const MAX_HINT_IMAGE_URL_LENGTH = 2048;

/**
 * 回傳整理過的 tags；格式不正確時回傳 null
 */
export const parseTags = (tags: unknown): string[] | null => {
  if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
    return null;
  }
  const cleaned = [...new Set(tags.map(tag => tag.trim()).filter(Boolean))];
  if (cleaned.length > MAX_TAGS || cleaned.some(tag => tag.length > MAX_TAG_LENGTH)) {
    return null;
  }
  return cleaned;
};

/**
 * 接受 { url } 或 { text }：iOS 分享選單有些 app 只給一段含網址的文字。
 * url 本身就是合法網址時原樣使用，不做抽取（避免截掉網址結尾的括號等字元）。
 */
export const resolveInputUrl = (url: unknown, text: unknown): string | null => {
  const candidate = typeof url === 'string' ? url.trim() : '';
  if (candidate && isHttpUrl(candidate)) {
    return candidate;
  }
  const source = candidate || (typeof text === 'string' ? text : '');
  return source ? extractUrlFromText(source) : null;
};

const cleanText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
};

/**
 * 裝置端送來的 og metadata 只是「提示」：格式不對的欄位直接忽略，
 * 不讓分享因為抓到奇怪的 og tag 而失敗。
 */
export const parseMetadataHints = (metadata: unknown): MetadataHints | undefined => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const raw = metadata as Record<string, unknown>;
  const image = typeof raw.image === 'string' ? raw.image.trim() : '';

  const hints: MetadataHints = {
    title: cleanText(raw.title, MAX_HINT_TITLE_LENGTH),
    description: cleanText(raw.description, MAX_HINT_DESCRIPTION_LENGTH),
    image: image && image.length <= MAX_HINT_IMAGE_URL_LENGTH && isHttpUrl(image) ? image : undefined
  };

  return hints.title || hints.description || hints.image ? hints : undefined;
};
