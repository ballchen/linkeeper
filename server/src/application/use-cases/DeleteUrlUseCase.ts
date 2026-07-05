import { UrlRepository } from '../../domain/repositories/UrlRepository';

export class DeleteUrlUseCase {
  constructor(private readonly urlRepository: UrlRepository) {}

  async execute(id: string, ownerEmail: string): Promise<void> {
    // Check if URL exists (this will only find non-deleted URLs)
    const existingUrl = await this.urlRepository.findById(id);

    // 非擁有者一律回 not found，避免洩漏資料是否存在
    // （ownerEmail 為 null 的舊資料允許刪除，見 migrateOwnership script）
    if (!existingUrl || (existingUrl.ownerEmail && existingUrl.ownerEmail !== ownerEmail)) {
      throw new Error(`URL with id ${id} not found`);
    }

    // Perform soft delete
    await this.urlRepository.softDelete(id);
  }
}
