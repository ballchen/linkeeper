import { Url } from '../../domain/entities/Url';
import { UrlRepository } from '../../domain/repositories/UrlRepository';
import { MetadataService } from '../../domain/services/MetadataService';
import { UrlAnalysisService } from '../../domain/services/UrlAnalysisService';

export interface AddUrlRequest {
  url: string;
  ownerEmail: string;
  tags?: string[];
}

export interface AddUrlResponse {
  url: Url;
  isNew: boolean;
}

export class AddUrlUseCase {
  constructor(
    private readonly urlRepository: UrlRepository,
    private readonly metadataService: MetadataService,
    private readonly urlAnalysisService: UrlAnalysisService
  ) {}

  async execute(request: AddUrlRequest): Promise<AddUrlResponse> {
    // Check if URL already exists for this owner
    const existingUrl = await this.urlRepository.findByUrl(request.url, request.ownerEmail);
    if (existingUrl) {
      return {
        url: existingUrl,
        isNew: false
      };
    }

    // Fetch metadata for the URL
    const metadata = await this.metadataService.fetchMetadata(request.url);

    // Analyze URL to detect source
    const analysisResult = await this.urlAnalysisService.analyzeUrl(request.url);

    // Combine metadata with analysis results and tags
    const enrichedMetadata = {
      ...metadata,
      source: analysisResult.source,
      tags: request.tags || []
    };

    // Create new URL entity
    const newUrl = Url.create(request.url, enrichedMetadata, request.ownerEmail);

    // Save to repository
    const savedUrl = await this.urlRepository.save(newUrl);

    return {
      url: savedUrl,
      isNew: true
    };
  }
} 