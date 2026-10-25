import { Url } from '../../domain/entities/Url';
import { UrlRepository } from '../../domain/repositories/UrlRepository';

export class UpdateUrlTagsUseCase {
  constructor(private readonly urlRepository: UrlRepository) {}

  async execute(id: string, ownerEmail: string, tags: string[]): Promise<Url> {
    const existingUrl = await this.urlRepository.findById(id);

    // 與 DeleteUrlUseCase 相同：非擁有者一律回 not found
    if (!existingUrl || (existingUrl.ownerEmail && existingUrl.ownerEmail !== ownerEmail)) {
      throw new Error(`URL with id ${id} not found`);
    }

    const updatedUrl = await this.urlRepository.updateTags(id, [...new Set(tags)]);
    if (!updatedUrl) {
      throw new Error(`URL with id ${id} not found`);
    }

    return updatedUrl;
  }
}
