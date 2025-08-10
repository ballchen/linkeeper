import { UrlRepository } from '../../domain/repositories/UrlRepository';

export class DeleteUrlUseCase {
  constructor(private readonly urlRepository: UrlRepository) {}

  async execute(id: string): Promise<void> {
    // Check if URL exists (this will only find non-deleted URLs)
    const existingUrl = await this.urlRepository.findById(id);
    
    if (!existingUrl) {
      throw new Error(`URL with id ${id} not found`);
    }

    // Perform soft delete
    await this.urlRepository.softDelete(id);
  }
}