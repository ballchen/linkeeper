import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnrichUrlUseCase } from '../../src/application/use-cases/EnrichUrlUseCase';
import { Url, UrlMetadata } from '../../src/domain/entities/Url';
import { MetadataService } from '../../src/domain/services/MetadataService';
import { InMemoryUrlRepository } from '../helpers/InMemoryUrlRepository';

const OWNER = 'me@example.com';

describe('EnrichUrlUseCase', () => {
  let repo: InMemoryUrlRepository;
  let metadataService: { fetchMetadata: ReturnType<typeof vi.fn>; storeImage: ReturnType<typeof vi.fn> };
  let useCase: EnrichUrlUseCase;

  const savePending = (metadata: UrlMetadata = {}) =>
    repo.save(Url.create('https://example.com/', metadata, OWNER, 'pending'));

  beforeEach(() => {
    repo = new InMemoryUrlRepository();
    metadataService = {
      fetchMetadata: vi.fn().mockResolvedValue({ title: 'Scraped', description: 'scraped desc', image: 'images/scraped.jpg' }),
      storeImage: vi.fn().mockResolvedValue('images/hint.jpg')
    };
    useCase = new EnrichUrlUseCase(repo, metadataService as MetadataService);
  });

  it('fills metadata from scraping and marks the URL ready', async () => {
    const url = await savePending({ tags: ['keep'] });

    await useCase.execute(url.id);

    const updated = await repo.findById(url.id);
    expect(updated?.status).toBe('ready');
    expect(updated?.metadata).toMatchObject({
      title: 'Scraped',
      description: 'scraped desc',
      image: 'images/scraped.jpg',
      tags: ['keep']
    });
    expect(metadataService.storeImage).not.toHaveBeenCalled();
  });

  it('skips scraping when the device provided both title and image', async () => {
    const url = await savePending({ title: 'From Safari', imageSourceUrl: 'https://cdn.example.com/og.jpg' });

    await useCase.execute(url.id);

    expect(metadataService.fetchMetadata).not.toHaveBeenCalled();
    expect(metadataService.storeImage).toHaveBeenCalledWith('https://cdn.example.com/og.jpg', 'https://example.com/');
    const updated = await repo.findById(url.id);
    expect(updated?.metadata).toMatchObject({ title: 'From Safari', image: 'images/hint.jpg' });
  });

  it('prefers device hints but fills missing fields from scraping', async () => {
    const url = await savePending({ title: 'From Safari' });

    await useCase.execute(url.id);

    const updated = await repo.findById(url.id);
    expect(updated?.metadata).toMatchObject({
      title: 'From Safari',
      description: 'scraped desc',
      image: 'images/scraped.jpg'
    });
  });

  it('falls back to scraping when the hinted image cannot be stored', async () => {
    metadataService.storeImage.mockResolvedValue('');
    const url = await savePending({ title: 'From Safari', imageSourceUrl: 'https://cdn.example.com/expired.jpg' });

    await useCase.execute(url.id);

    expect(metadataService.fetchMetadata).toHaveBeenCalled();
    expect((await repo.findById(url.id))?.metadata.image).toBe('images/scraped.jpg');
  });

  it('marks ready even when scraping finds nothing', async () => {
    metadataService.fetchMetadata.mockResolvedValue({ title: '', description: '', image: '' });
    const url = await savePending();

    await useCase.execute(url.id);

    expect((await repo.findById(url.id))?.status).toBe('ready');
  });

  it('does nothing for deleted or already processed URLs', async () => {
    const deleted = await savePending();
    await repo.softDelete(deleted.id);
    const ready = await repo.save(Url.create('https://ready.example/', {}, OWNER, 'ready'));

    await useCase.execute(deleted.id);
    await useCase.execute(ready.id);
    await useCase.execute('missing');

    expect(metadataService.fetchMetadata).not.toHaveBeenCalled();
  });

  it('propagates repository errors so the queue can retry', async () => {
    const url = await savePending();
    vi.spyOn(repo, 'updateEnrichment').mockRejectedValueOnce(new Error('db down'));
    await expect(useCase.execute(url.id)).rejects.toThrow('db down');
  });

  it('markFailed sets failed status without touching metadata', async () => {
    const url = await savePending({ title: 'kept' });
    await useCase.markFailed(url.id);
    const updated = await repo.findById(url.id);
    expect(updated?.status).toBe('failed');
    expect(updated?.metadata.title).toBe('kept');
  });
});
