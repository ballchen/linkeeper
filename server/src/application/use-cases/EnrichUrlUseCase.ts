import { UrlMetadata } from '../../domain/entities/Url';
import { UrlRepository } from '../../domain/repositories/UrlRepository';
import { MetadataService } from '../../domain/services/MetadataService';

export class EnrichUrlUseCase {
  constructor(
    private readonly urlRepository: UrlRepository,
    private readonly metadataService: MetadataService
  ) {}

  /**
   * 抓取 metadata 並把連結標記為 ready；連結已刪除或已處理過則略過。
   * 裝置端提供的 metadata（新增時存入的 title / description / imageSourceUrl）優先：
   * 那是使用者實際看到的頁面，對 IG、FB 這類擋 server 爬蟲的網站特別有用。
   */
  async execute(urlId: string): Promise<void> {
    const url = await this.urlRepository.findById(urlId);
    if (!url || url.status !== 'pending') {
      return;
    }

    const { title, description, imageSourceUrl } = url.metadata;

    const hintedImage = imageSourceUrl
      ? await this.metadataService.storeImage(imageSourceUrl, url.url)
      : '';

    // 標題與圖片都有了就不必再爬網頁
    // fetchMetadata 失敗時回傳空 metadata 而非丟錯，連結仍視為處理完成
    const fetched: UrlMetadata = title && hintedImage
      ? {}
      : await this.metadataService.fetchMetadata(url.url);

    await this.urlRepository.updateEnrichment(urlId, {
      title: title || fetched.title,
      description: description || fetched.description,
      image: hintedImage || fetched.image
    }, 'ready');
  }

  async markFailed(urlId: string): Promise<void> {
    await this.urlRepository.updateEnrichment(urlId, {}, 'failed');
  }
}
