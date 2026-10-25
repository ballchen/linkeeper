import { beforeEach, describe, expect, it } from 'vitest';
import { UpdateUrlTagsUseCase } from '../../src/application/use-cases/UpdateUrlTagsUseCase';
import { DeleteUrlUseCase } from '../../src/application/use-cases/DeleteUrlUseCase';
import { Url } from '../../src/domain/entities/Url';
import { InMemoryUrlRepository } from '../helpers/InMemoryUrlRepository';

const OWNER = 'me@example.com';
const OTHER = 'other@example.com';

describe('UpdateUrlTagsUseCase', () => {
  let repo: InMemoryUrlRepository;
  let useCase: UpdateUrlTagsUseCase;

  beforeEach(() => {
    repo = new InMemoryUrlRepository();
    useCase = new UpdateUrlTagsUseCase(repo);
  });

  it('replaces tags (deduped) for the owner', async () => {
    const url = await repo.save(Url.create('https://example.com', { tags: ['old'] }, OWNER));
    const updated = await useCase.execute(url.id, OWNER, ['a', 'b', 'a']);
    expect(updated.metadata.tags).toEqual(['a', 'b']);
  });

  it('allows clearing all tags', async () => {
    const url = await repo.save(Url.create('https://example.com', { tags: ['old'] }, OWNER));
    expect((await useCase.execute(url.id, OWNER, [])).metadata.tags).toEqual([]);
  });

  it('allows legacy rows without an owner', async () => {
    const url = await repo.save(Url.create('https://example.com', {}, null));
    expect((await useCase.execute(url.id, OWNER, ['x'])).metadata.tags).toEqual(['x']);
  });

  it('reports not found for other owners, deleted or missing URLs', async () => {
    const url = await repo.save(Url.create('https://example.com', {}, OWNER));
    await expect(useCase.execute(url.id, OTHER, ['x'])).rejects.toThrow('not found');

    await repo.softDelete(url.id);
    await expect(useCase.execute(url.id, OWNER, ['x'])).rejects.toThrow('not found');
    await expect(useCase.execute('missing', OWNER, ['x'])).rejects.toThrow('not found');
  });
});

describe('DeleteUrlUseCase', () => {
  it('soft-deletes only the owner\'s URL', async () => {
    const repo = new InMemoryUrlRepository();
    const useCase = new DeleteUrlUseCase(repo);
    const url = await repo.save(Url.create('https://example.com', {}, OWNER));

    await expect(useCase.execute(url.id, OTHER)).rejects.toThrow('not found');
    await useCase.execute(url.id, OWNER);

    expect(await repo.findById(url.id)).toBeNull();
    expect(repo.rows.get(url.id)?.deleted).toBe(true);
  });
});
