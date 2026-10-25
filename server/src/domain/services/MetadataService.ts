import { UrlMetadata } from '../entities/Url';

export interface MetadataService {
  fetchMetadata(url: string): Promise<UrlMetadata>;
  /** 下載預覽圖並存到圖片儲存，回傳 key；失敗回傳空字串 */
  storeImage(imageUrl: string, pageUrl: string): Promise<string>;
} 