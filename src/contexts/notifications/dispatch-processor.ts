import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Agenda, Job as AgendaJob } from 'agenda';
import { NotificationsService } from './notifications.service';
import { Job, JobDocument, JobStatus } from './job.schema';
import { Batch, BatchDocument, BatchStatus } from './batch.schema';

@Injectable()
export class DispatchProcessor implements OnModuleInit {
  private readonly logger = new Logger(DispatchProcessor.name);

  private static readonly MAX_LOAD_ATTEMPTS = 3;
  private static readonly RETRY_BACKOFF_MS = 60000;

  constructor(
    @Inject('AGENDA') private agenda: Agenda,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Batch.name) private batchModel: Model<BatchDocument>,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.agenda.define('notifications.dispatch', async (agendaJob: AgendaJob) => {
      const data = agendaJob.attrs.data as { jobId: string; attempt?: number };
      const jobId = data?.jobId;
      if (jobId) {
        await this.processJob(jobId, data.attempt ?? 0);
      }
    }, { concurrency: 1 });

    // Agenda stores failReason in Mongo but says nothing otherwise, so a job
    // that dies before touching its Job document used to fail in total silence.
    this.agenda.on('fail', (error: Error, agendaJob: AgendaJob) => {
      this.logger.error(
        `Agenda job "${agendaJob.attrs.name}" failed (data: ${JSON.stringify(agendaJob.attrs.data)}): ${error?.message}`,
      );
    });

    this.agenda.start().then(() => this.logger.log('Agenda processor started'));
  }

  private async processJob(jobId: string, attempt: number) {
    let job: JobDocument | null;

    try {
      job = await this.jobModel.findById(jobId);
    } catch (error: any) {
      // The Job document is unreachable, so it stays QUEUED and its Batch stays
      // PROCESSING. Agenda leaves nextRunAt null on failure, so without an
      // explicit reschedule the batch would sit unfinished forever.
      await this.scheduleRetry(jobId, attempt, error);
      throw error;
    }

    if (!job || job.status !== JobStatus.QUEUED) return;

    this.logger.log(`Processing job ${jobId} for ${job.to}. (Scheduled for: ${job.scheduledFor.toISOString()})`);

    try {
      // Use NotificationsService to leverage daily cap and audit log logic
      const result = await this.notificationsService.dispatch({
        channel: job.channel,
        to: job.to,
        message: job.message,
      });

      job.status = JobStatus.DISPATCHED;
      job.providerMessageId = result.providerMessageId;
      job.processedAt = new Date();
      await job.save();

      if (job.batchId) {
        await this.updateBatchProgress(job.batchId, 'success');
      }
    } catch (error: any) {
      if (error?.status === 429) {
        // Daily cap hit, cancel this and potentially other pending jobs in this batch
        job.status = JobStatus.CANCELLED_DAILY_CAP;
        job.error = 'Daily cap reached';
        await job.save();
        
        if (job.batchId) {
          await this.cancelRemainingBatchJobs(job.batchId);
        }
      } else {
        job.status = JobStatus.FAILED;
        job.error = error?.message || 'Unknown error';
        await job.save();
        
        if (job.batchId) {
          await this.updateBatchProgress(job.batchId, 'failure');
        }
      }
    }
  }

  private async scheduleRetry(jobId: string, attempt: number, error: Error) {
    if (attempt >= DispatchProcessor.MAX_LOAD_ATTEMPTS) {
      this.logger.error(
        `Giving up on job ${jobId} after ${attempt} load attempts: ${error?.message}`,
      );
      return;
    }

    const nextAttempt = attempt + 1;
    const runAt = new Date(Date.now() + nextAttempt * DispatchProcessor.RETRY_BACKOFF_MS);

    this.logger.warn(
      `Could not load job ${jobId} (${error?.message}). Retry ${nextAttempt} at ${runAt.toISOString()}`,
    );

    await this.agenda.schedule(runAt, 'notifications.dispatch', {
      jobId,
      attempt: nextAttempt,
    });
  }

  private async updateBatchProgress(batchId: Types.ObjectId | undefined, result: 'success' | 'failure') {
    if (!batchId) return;
    const update: any = { $inc: { processedRows: 1 } };
    if (result === 'success') {
      update.$inc.successCount = 1;
    } else {
      update.$inc.failureCount = 1;
    }

    const batch = await this.batchModel.findByIdAndUpdate(batchId, update, { returnDocument: 'after' });
    
    if (batch && batch.processedRows >= batch.totalRows) {
      batch.status = BatchStatus.COMPLETED;
      await batch.save();
    }
  }

  private async cancelRemainingBatchJobs(batchId: Types.ObjectId | undefined) {
    if (!batchId) return;
    await this.jobModel.updateMany(
      { batchId, status: JobStatus.QUEUED },
      { status: JobStatus.CANCELLED_DAILY_CAP, error: 'Daily cap reached' }
    );
    
    await this.batchModel.findByIdAndUpdate(batchId, { 
      status: BatchStatus.FAILED,
      // We could also calculate how many were cancelled
    });
  }
}
