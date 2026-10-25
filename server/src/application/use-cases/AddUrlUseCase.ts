import { Url } from '../../domain/entities/Url';
import { UrlRepository, DuplicateUrlError } from '../../domain/repositories/UrlRepository';
import { UrlAnalysisService } from '../../domain/services/UrlAnalysisService';
import { UrlEnrichmentQueue } from '../../domain/services/UrlEnrichmentQueue';
import { normalizeUrl } from '../../utils/urlNormalize';

/** 裝置端（例如 iOS Share Extension 從 Safari 頁面）讀到的 og metadata */
export interface MetadataHints {
  title?: string;
  description?: string;
  image?: string;
}

export interface AddUrlRequest {
  url: string;
  ownerEmail: string;
  tags?: string[];
  hints?: MetadataHints;
}

export interface AddUrlResponse {
  url: Url;
  isNew: boolean;
}

export class AddUrlUseCase {
  constructor(
    private readonly urlRepository: UrlRepository,
    private readonly urlAnalysisService: UrlAnalysisService,
    private readonly enrichmentQueue: UrlEnrichmentQueue
  ) {}

  /**
   * 立即存入（status=pending）並回應，metadata 交由背景佇列處理。
   * 來源判斷只看網址本身，很快，所以同步完成。
   */
  async execute(request: AddUrlRequest): Promise<AddUrlResponse> {
    const url = normalizeUrl(request.url);

    // Check if URL already exists for this owner
    const existingUrl = await this.urlRepository.findByUrl(url, request.ownerEmail);
    if (existingUrl) {
      return {
        url: existingUrl,
        isNew: false
      };
    }

    const analysisResult = await this.urlAnalysisService.analyzeUrl(url);

    // 標題先用裝置端提供的，卡片不必等背景處理就有內容
    const newUrl = Url.create(url, {
      title: request.hints?.title,
      description: request.hints?.description,
      imageSourceUrl: request.hints?.image,
      source: analysisResult.source,
      tags: request.tags || []
    }, request.ownerEmail, 'pending');

    let savedUrl: Url;
    try {
      savedUrl = await this.urlRepository.save(newUrl);
    } catch (error) {
      // 同一連結的併發請求：另一個請求先存進去了，視為已存在
      if (error instanceof DuplicateUrlError) {
        const concurrentUrl = await this.urlRepository.findByUrl(url, request.ownerEmail);
        if (concurrentUrl) {
          return { url: concurrentUrl, isNew: false };
        }
      }
      throw error;
    }

    this.enrichmentQueue.enqueue(savedUrl.id);

    return {
      url: savedUrl,
      isNew: true
    };
  }
}
