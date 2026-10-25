import { UrlRepository } from '../../domain/repositories/UrlRepository';
import { UrlEnrichmentQueue } from '../../domain/services/UrlEnrichmentQueue';

export class RefreshUrlUseCase {
  constructor(
    private readonly urlRepository: UrlRepository,
    private readonly enrichmentQueue: UrlEnrichmentQueue
  ) {}

  /** 把連結重新排入 metadata 處理（例如 iOS 的「重新抓取」）；處理中的連結不重複排入 */
  async execute(id: string, ownerEmail: string): Promise<void> {
    const existingUrl = await this.urlRepository.findById(id);

    // 與 DeleteUrlUseCase 相同：非擁有者一律回 not found
    if (!existingUrl || (existingUrl.ownerEmail && existingUrl.ownerEmail !== ownerEmail)) {
      throw new Error(`URL with id ${id} not found`);
    }

    if (existingUrl.status !== 'pending') {
      await this.urlRepository.updateEnrichment(id, {}, 'pending');
    }
    this.enrichmentQueue.enqueue(id);
  }
}
