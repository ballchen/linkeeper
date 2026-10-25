import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InProcessUrlEnrichmentQueue } from '../../src/infrastructure/services/InProcessUrlEnrichmentQueue';
import { EnrichUrlUseCase } from '../../src/application/use-cases/EnrichUrlUseCase';
import { Url } from '../../src/domain/entities/Url';
import { InMemoryUrlRepository } from '../helpers/InMemoryUrlRepository';

/** 可手動控制完成時機的 promise */
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('InProcessUrlEnrichmentQueue', () => {
  let repo: InMemoryUrlRepository;
  let enrich: { execute: ReturnType<typeof vi.fn>; markFailed: ReturnType<typeof vi.fn> };

  const createQueue = (concurrency = 2, maxAttempts = 3) =>
    new InProcessUrlEnrichmentQueue(enrich as unknown as EnrichUrlUseCase, repo, concurrency, maxAttempts, 1000);

  beforeEach(() => {
    vi.useFakeTimers();
    repo = new InMemoryUrlRepository();
    enrich = { execute: vi.fn().mockResolvedValue(undefined), markFailed: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('processes enqueued URLs', async () => {
    createQueue().enqueue('1');
    await vi.runAllTimersAsync();
    expect(enrich.execute).toHaveBeenCalledWith('1');
  });

  it('ignores duplicate enqueues while a URL is in flight', async () => {
    const queue = createQueue();
    queue.enqueue('1');
    queue.enqueue('1');
    await vi.runAllTimersAsync();
    expect(enrich.execute).toHaveBeenCalledTimes(1);

    // 處理完成後可以再次排入
    queue.enqueue('1');
    await vi.runAllTimersAsync();
    expect(enrich.execute).toHaveBeenCalledTimes(2);
  });

  it('never runs more jobs than the concurrency limit', async () => {
    const jobs = [deferred(), deferred(), deferred()];
    jobs.forEach(job => enrich.execute.mockReturnValueOnce(job.promise));
    const queue = createQueue(2);

    ['1', '2', '3'].forEach(id => queue.enqueue(id));
    expect(enrich.execute).toHaveBeenCalledTimes(2);

    jobs[0].resolve();
    await vi.runAllTimersAsync();
    expect(enrich.execute).toHaveBeenCalledTimes(3);
    expect(enrich.execute).toHaveBeenLastCalledWith('3');

    jobs[1].resolve();
    jobs[2].resolve();
  });

  it('retries with exponential backoff and succeeds', async () => {
    enrich.execute.mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom'));
    createQueue().enqueue('1');

    await vi.advanceTimersByTimeAsync(0);
    expect(enrich.execute).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(enrich.execute).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(enrich.execute).toHaveBeenCalledTimes(2);

    // 第二次重試等 2 倍時間
    await vi.advanceTimersByTimeAsync(1999);
    expect(enrich.execute).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(enrich.execute).toHaveBeenCalledTimes(3);

    expect(enrich.markFailed).not.toHaveBeenCalled();
  });

  it('marks the URL failed after the last attempt', async () => {
    enrich.execute.mockRejectedValue(new Error('boom'));
    createQueue(2, 3).enqueue('1');

    await vi.runAllTimersAsync();

    expect(enrich.execute).toHaveBeenCalledTimes(3);
    expect(enrich.markFailed).toHaveBeenCalledWith('1');
  });

  it('keeps working when marking failed also fails', async () => {
    enrich.execute.mockRejectedValueOnce(new Error('boom'));
    enrich.markFailed.mockRejectedValueOnce(new Error('db down'));
    const queue = createQueue(1, 1);

    queue.enqueue('1');
    queue.enqueue('2');
    await vi.runAllTimersAsync();

    expect(enrich.execute).toHaveBeenLastCalledWith('2');
  });

  it('recovers pending URLs from the repository on startup', async () => {
    const pending = await repo.save(Url.create('https://a.example/', {}, 'me@example.com', 'pending'));
    await repo.save(Url.create('https://b.example/', {}, 'me@example.com', 'ready'));

    await createQueue().recoverPending();
    await vi.runAllTimersAsync();

    expect(enrich.execute).toHaveBeenCalledTimes(1);
    expect(enrich.execute).toHaveBeenCalledWith(pending.id);
  });
});
