import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agenda, Job as AgendaJob } from 'agenda';
import { DispatchProcessor } from './dispatch-processor';
import { NotificationsService } from './notifications.service';
import { Job, JobStatus } from './job.schema';
import { Batch, BatchStatus } from './batch.schema';

/**
 * A dispatch job that dies without touching its Job document strands the whole
 * batch: the row stays `queued`, the batch stays `processing`, and Agenda
 * leaves `nextRunAt: null` so nothing ever retries. Failures must be loud and
 * must reach Agenda, which is what persists `failReason`.
 */
describe('DispatchProcessor', () => {
  let processor: DispatchProcessor;
  let handler: (job: AgendaJob) => Promise<void>;
  let jobModel: any;
  let batchModel: any;
  let notificationsService: { dispatch: ReturnType<typeof vi.fn> };
  let agenda: any;

  const JOB_ID = '6a7750c1b72fe93a346d1675';
  const BATCH_ID = '6a7750c1b72fe93a346d1674';

  const buildJobDoc = (overrides: Record<string, unknown> = {}): Record<string, any> => ({
    _id: JOB_ID,
    batchId: BATCH_ID,
    to: '+59893700567',
    message: 'hola',
    channel: 'whatsapp',
    status: JobStatus.QUEUED,
    scheduledFor: new Date('2026-08-08T15:53:10.579Z'),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const runHandler = () =>
    handler({ attrs: { data: { jobId: JOB_ID } } } as unknown as AgendaJob);

  beforeEach(async () => {
    jobModel = { findById: vi.fn(), updateMany: vi.fn().mockResolvedValue(undefined) };
    batchModel = {
      findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    };
    notificationsService = { dispatch: vi.fn() };
    agenda = {
      define: vi.fn((_name: string, fn: any) => {
        handler = fn;
      }),
      start: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchProcessor,
        { provide: 'AGENDA', useValue: agenda as unknown as Agenda },
        { provide: getModelToken(Job.name), useValue: jobModel },
        { provide: getModelToken(Batch.name), useValue: batchModel },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    processor = module.get(DispatchProcessor);
    processor.onModuleInit();
  });

  it('propagates the error when the job document cannot be loaded, so Agenda records failReason', async () => {
    jobModel.findById.mockRejectedValue(
      new Error('Client must be connected before running operations'),
    );

    await expect(runHandler()).rejects.toThrow('Client must be connected');
  });

  it('reschedules a retry when the job cannot be loaded, instead of stranding the batch', async () => {
    jobModel.findById.mockRejectedValue(
      new Error('Client must be connected before running operations'),
    );

    await expect(runHandler()).rejects.toThrow();

    expect(agenda.schedule).toHaveBeenCalledWith(
      expect.any(Date),
      'notifications.dispatch',
      { jobId: JOB_ID, attempt: 1 },
    );
  });

  it('stops retrying once the attempt limit is reached', async () => {
    jobModel.findById.mockRejectedValue(new Error('still down'));

    await expect(
      handler({ attrs: { data: { jobId: JOB_ID, attempt: 3 } } } as unknown as AgendaJob),
    ).rejects.toThrow('still down');

    expect(agenda.schedule).not.toHaveBeenCalled();
  });

  it('marks the job FAILED and advances the batch when dispatch throws', async () => {
    const doc = buildJobDoc();
    jobModel.findById.mockResolvedValue(doc);
    notificationsService.dispatch.mockRejectedValue(new Error('WhatsApp service is not connected'));

    await runHandler();

    expect(doc.status).toBe(JobStatus.FAILED);
    expect(doc.error).toBe('WhatsApp service is not connected');
    expect(batchModel.findByIdAndUpdate).toHaveBeenCalledWith(
      BATCH_ID,
      { $inc: { processedRows: 1, failureCount: 1 } },
      { returnDocument: 'after' },
    );
  });

  it('cancels the remaining batch rows when the daily cap is hit', async () => {
    const doc = buildJobDoc();
    jobModel.findById.mockResolvedValue(doc);
    notificationsService.dispatch.mockRejectedValue(
      Object.assign(new Error('Daily message cap reached'), { status: 429 }),
    );

    await runHandler();

    expect(doc.status).toBe(JobStatus.CANCELLED_DAILY_CAP);
    expect(jobModel.updateMany).toHaveBeenCalled();
    expect(batchModel.findByIdAndUpdate).toHaveBeenCalledWith(BATCH_ID, {
      status: BatchStatus.FAILED,
    });
  });

  it('marks the job DISPATCHED and advances the batch on success', async () => {
    const doc = buildJobDoc();
    jobModel.findById.mockResolvedValue(doc);
    notificationsService.dispatch.mockResolvedValue({ providerMessageId: 'ABC123' });

    await runHandler();

    expect(doc.status).toBe(JobStatus.DISPATCHED);
    expect(batchModel.findByIdAndUpdate).toHaveBeenCalledWith(
      BATCH_ID,
      { $inc: { processedRows: 1, successCount: 1 } },
      { returnDocument: 'after' },
    );
  });

  it('registers a fail listener so Agenda failures surface in the logs', () => {
    expect(agenda.on).toHaveBeenCalledWith('fail', expect.any(Function));
  });
});
