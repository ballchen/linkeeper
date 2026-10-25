/**
 * 新增連結後的 metadata 處理（抓標題、預覽圖、上傳 S3）在背景執行，
 * 讓新增 API 能立即回應（iOS Share Extension 不必等待）。
 */
export interface UrlEnrichmentQueue {
  enqueue(urlId: string): void;
}
