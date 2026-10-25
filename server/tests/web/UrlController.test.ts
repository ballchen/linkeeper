import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UrlController } from '../../src/infrastructure/web/controllers/UrlController';
import { AddUrlUseCase } from '../../src/application/use-cases/AddUrlUseCase';
import { GetUrlsUseCase } from '../../src/application/use-cases/GetUrlsUseCase';
import { DeleteUrlUseCase } from '../../src/application/use-cases/DeleteUrlUseCase';
import { UpdateUrlTagsUseCase } from '../../src/application/use-cases/UpdateUrlTagsUseCase';
import { RefreshUrlUseCase } from '../../src/application/use-cases/RefreshUrlUseCase';
import { HttpUrlAnalysisService } from '../../src/infrastructure/services/HttpUrlAnalysisService';
import { S3ImageService } from '../../src/infrastructure/services/S3ImageService';
import { InMemoryUrlRepository } from '../helpers/InMemoryUrlRepository';
import { mockRequest, mockResponse } from '../helpers/http';

const OWNER = 'me@example.com';
const user = { id: 'u1', email: OWNER, name: 'Me' };

describe('UrlController', () => {
  let repo: InMemoryUrlRepository;
  let queue: { enqueue: ReturnType<typeof vi.fn> };
  let controller: UrlController;

  const s3: S3ImageService = {
    uploadImageFromUrl: vi.fn(),
    getImageUrl: async (key: string) => `https://signed.example/${key}`
  };

  beforeEach(() => {
    repo = new InMemoryUrlRepository();
    queue = { enqueue: vi.fn() };
    controller = new UrlController(
      new AddUrlUseCase(repo, new HttpUrlAnalysisService(), queue),
      new GetUrlsUseCase(repo),
      new DeleteUrlUseCase(repo),
      new UpdateUrlTagsUseCase(repo),
      new RefreshUrlUseCase(repo, queue),
      s3
    );
  });

  const add = async (body: unknown) => {
    const res = mockResponse();
    await controller.addUrl(mockRequest({ user, body }), res);
    return res;
  };

  describe('addUrl', () => {
    it('returns 201 with pending status for a new URL', async () => {
      const res = await add({ url: 'https://example.com/?utm_source=x' });
      expect(res.statusCode).toBe(201);
      expect(res.body).toMatchObject({ url: 'https://example.com/', status: 'pending', isNew: true });
      expect(res.body.id).toBe(res.body._id);
    });

    it('returns 200 with isNew=false for a duplicate', async () => {
      await add({ url: 'https://example.com/' });
      const res = await add({ url: 'https://example.com/#top' });
      expect(res.statusCode).toBe(200);
      expect(res.body.isNew).toBe(false);
    });

    it('accepts shared text containing a URL', async () => {
      const res = await add({ text: '看這個 https://www.youtube.com/watch?v=abc&si=xyz 超讚' });
      expect(res.statusCode).toBe(201);
      expect(res.body).toMatchObject({ url: 'https://www.youtube.com/watch?v=abc', source: 'youtube' });
    });

    it('passes metadata hints through so the title shows immediately', async () => {
      const res = await add({
        url: 'https://example.com/',
        metadata: { title: ' From Safari ', image: 'https://cdn.example.com/og.jpg' }
      });
      expect(res.body.title).toBe('From Safari');
      const saved = await repo.findById(res.body.id);
      expect(saved?.metadata.imageSourceUrl).toBe('https://cdn.example.com/og.jpg');
    });

    it('still saves when metadata hints are malformed', async () => {
      const res = await add({ url: 'https://example.com/', metadata: 'garbage' });
      expect(res.statusCode).toBe(201);
    });

    it.each([
      [{}],
      [{ text: 'no url here' }],
      [{ url: 'javascript:alert(1)' }]
    ])('returns 400 when no usable URL is given: %j', async (body) => {
      expect((await add(body)).statusCode).toBe(400);
    });

    it('returns 400 for invalid tags', async () => {
      expect((await add({ url: 'https://example.com', tags: 'x' })).statusCode).toBe(400);
      expect((await add({ url: 'https://example.com', tags: [1] })).statusCode).toBe(400);
    });

    it('returns 401 without a user', async () => {
      const res = mockResponse();
      await controller.addUrl(mockRequest({ body: { url: 'https://example.com' } }), res);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('updateTags', () => {
    it('updates tags for the owner', async () => {
      const created = await add({ url: 'https://example.com/' });
      const res = mockResponse();
      await controller.updateTags(mockRequest({ user, params: { id: created.body.id }, body: { tags: ['a', ' a'] } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.tags).toEqual(['a']);
    });

    it('returns 404 for another owner\'s URL', async () => {
      const created = await add({ url: 'https://example.com/' });
      const res = mockResponse();
      await controller.updateTags(mockRequest({
        user: { ...user, email: 'other@example.com' },
        params: { id: created.body.id },
        body: { tags: ['a'] }
      }), res);
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid tags', async () => {
      const res = mockResponse();
      await controller.updateTags(mockRequest({ user, params: { id: '1' }, body: { tags: 'a' } }), res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('refreshUrl', () => {
    it('marks a failed URL pending again and re-enqueues it', async () => {
      const { body } = await add({ url: 'https://example.com/a' });
      await repo.updateEnrichment(body.id, {}, 'failed');
      queue.enqueue.mockClear();

      const res = mockResponse();
      await controller.refreshUrl(mockRequest({ user, params: { id: body.id } }), res);

      expect(res.statusCode).toBe(202);
      expect((await repo.findById(body.id))?.status).toBe('pending');
      expect(queue.enqueue).toHaveBeenCalledWith(body.id);
    });

    it("returns 404 for someone else's URL without enqueueing", async () => {
      const { body } = await add({ url: 'https://example.com/a' });
      queue.enqueue.mockClear();

      const res = mockResponse();
      await controller.refreshUrl(
        mockRequest({ user: { ...user, email: 'other@example.com' }, params: { id: body.id } }),
        res
      );

      expect(res.statusCode).toBe(404);
      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('getUrls', () => {
    it('includes status and signed image URLs', async () => {
      const created = await add({ url: 'https://example.com/' });
      await repo.updateEnrichment(created.body.id, { title: 'T', image: 'images/a.jpg' }, 'ready');

      const res = mockResponse();
      await controller.getUrls(mockRequest({ user }), res);

      expect(res.body).toEqual([expect.objectContaining({
        title: 'T',
        status: 'ready',
        image: 'https://signed.example/images/a.jpg'
      })]);
    });
  });
});
