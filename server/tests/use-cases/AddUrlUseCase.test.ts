import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddUrlUseCase } from '../../src/application/use-cases/AddUrlUseCase';
import { HttpUrlAnalysisService } from '../../src/infrastructure/services/HttpUrlAnalysisService';
import { Url } from '../../src/domain/entities/Url';
import { DuplicateUrlError } from '../../src/domain/repositories/UrlRepository';
import { InMemoryUrlRepository } from '../helpers/InMemoryUrlRepository';

const OWNER = 'me@example.com';

describe('AddUrlUseCase', () => {
  let repo: InMemoryUrlRepository;
  let queue: { enqueue: ReturnType<typeof vi.fn> };
  let useCase: AddUrlUseCase;

  beforeEach(() => {
    repo = new InMemoryUrlRepository();
    queue = { enqueue: vi.fn() };
    useCase = new AddUrlUseCase(repo, new HttpUrlAnalysisService(), queue);
  });

  it('saves a new URL as pending with source and tags, then enqueues processing', async () => {
    const result = await useCase.execute({
      url: 'https://www.instagram.com/reel/ABC/?igsh=xyz',
      ownerEmail: OWNER,
      tags: ['fun']
    });

    expect(result.isNew).toBe(true);
    expect(result.url.url).toBe('https://www.instagram.com/reel/ABC/');
    expect(result.url.status).toBe('pending');
    expect(result.url.metadata).toMatchObject({ source: 'instagram', tags: ['fun'] });
    expect(queue.enqueue).toHaveBeenCalledWith(result.url.id);
  });

  it('returns the existing URL for the same link shared with a different tracking id', async () => {
    const first = await useCase.execute({ url: 'https://www.instagram.com/reel/ABC/?igsh=one', ownerEmail: OWNER });
    const second = await useCase.execute({ url: 'https://www.instagram.com/reel/ABC/?igsh=two', ownerEmail: OWNER });

    expect(second.isNew).toBe(false);
    expect(second.url.id).toBe(first.url.id);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(repo.rows.size).toBe(1);
  });

  it('lets different owners save the same URL', async () => {
    await useCase.execute({ url: 'https://example.com', ownerEmail: OWNER });
    const other = await useCase.execute({ url: 'https://example.com', ownerEmail: 'other@example.com' });
    expect(other.isNew).toBe(true);
  });

  it('stores device-provided metadata hints so the card has a title immediately', async () => {
    const result = await useCase.execute({
      url: 'https://example.com',
      ownerEmail: OWNER,
      hints: { title: 'From Safari', description: 'desc', image: 'https://cdn.example.com/og.jpg' }
    });

    expect(result.url.metadata).toMatchObject({
      title: 'From Safari',
      description: 'desc',
      imageSourceUrl: 'https://cdn.example.com/og.jpg'
    });
    expect(result.url.metadata.image).toBeUndefined();
  });

  it('treats a concurrent duplicate save as an existing URL', async () => {
    const winner = await repo.save(Url.create('https://example.com/', {}, OWNER));
    // 模擬 race：查詢時還沒有，存入時才撞到唯一索引
    vi.spyOn(repo, 'findByUrl').mockResolvedValueOnce(null);

    const result = await useCase.execute({ url: 'https://example.com/', ownerEmail: OWNER });

    expect(result).toEqual({ url: winner, isNew: false });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('rethrows unexpected save errors', async () => {
    vi.spyOn(repo, 'save').mockRejectedValueOnce(new Error('db down'));
    await expect(useCase.execute({ url: 'https://example.com', ownerEmail: OWNER })).rejects.toThrow('db down');
  });

  it('rethrows DuplicateUrlError if the winning row cannot be found', async () => {
    vi.spyOn(repo, 'save').mockRejectedValueOnce(new DuplicateUrlError('https://example.com/'));
    await expect(useCase.execute({ url: 'https://example.com', ownerEmail: OWNER })).rejects.toThrow(DuplicateUrlError);
  });

  it('rejects invalid URLs before saving', async () => {
    await expect(useCase.execute({ url: 'javascript:alert(1)', ownerEmail: OWNER })).rejects.toThrow('Invalid URL');
    expect(repo.rows.size).toBe(0);
  });
});
