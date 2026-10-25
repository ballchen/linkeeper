import { UrlEnrichmentQueue } from '../../domain/services/UrlEnrichmentQueue';
import { UrlRepository } from '../../domain/repositories/UrlRepository';
import { EnrichUrlUseCase } from '../../application/use-cases/EnrichUrlUseCase';
import logger from '../../utils/logger';

interface Job {
  urlId: string;
  attempt: number;
}

/**
 * 單一 process 內的處理佇列。個人使用量不需要 Redis 之類的外部佇列；
 * process 重啟時由 recoverPending() 從 DB 撈回 status=pending 的連結重新處理。
 */
export class InProcessUrlEnrichmentQueue implements UrlEnrichmentQueue {
  private readonly jobs: Job[] = [];
  private readonly tracked = new Set<string>();
  private running = 0;

  constructor(
    private readonly enrichUrlUseCase: EnrichUrlUseCase,
    private readonly urlRepository: UrlRepository,
    private readonly concurrency = 2,
    private readonly maxAttempts = 3,
    private readonly retryBaseDelayMs = 5000
  ) {}

  enqueue(urlId: string): void {
    if (this.tracked.has(urlId)) return;
    this.tracked.add(urlId);
    this.push({ urlId, attempt: 1 });
  }

  async recoverPending(): Promise<void> {
    const pending = await this.urlRepository.findByStatus('pending');
    if (pending.length > 0) {
      logger.info(`Re-enqueueing ${pending.length} pending URL(s) for metadata processing`);
    }
    pending.forEach(url => this.enqueue(url.id));
  }

  private push(job: Job): void {
    this.jobs.push(job);
    this.drain();
  }

  private drain(): void {
    while (this.running < this.concurrency && this.jobs.length > 0) {
      const job = this.jobs.shift()!;
      this.running++;
      this.run(job).finally(() => {
        this.running--;
        this.drain();
      });
    }
  }

  private async run(job: Job): Promise<void> {
    try {
      await this.enrichUrlUseCase.execute(job.urlId);
      this.tracked.delete(job.urlId);
    } catch (error) {
      if (job.attempt < this.maxAttempts) {
        const delay = this.retryBaseDelayMs * 2 ** (job.attempt - 1);
        logger.warn(`Metadata processing failed for ${job.urlId} (attempt ${job.attempt}), retrying in ${delay}ms: ${error}`);
        setTimeout(() => this.push({ urlId: job.urlId, attempt: job.attempt + 1 }), delay);
        return;
      }

      logger.error(`Metadata processing failed for ${job.urlId} after ${job.attempt} attempts: ${error}`);
      this.tracked.delete(job.urlId);
      await this.enrichUrlUseCase.markFailed(job.urlId).catch(markError => {
        logger.error(`Failed to mark ${job.urlId} as failed: ${markError}`);
      });
    }
  }
}
