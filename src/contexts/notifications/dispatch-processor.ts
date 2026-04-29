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

  constructor(
    @Inject('AGENDA') private agenda: Agenda,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(Batch.name) private batchModel: Model<BatchDocument>,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.agenda.define('notifications.dispatch', async (agendaJob: AgendaJob) => {
      const data = agendaJob.attrs.data as { jobId: string };
      const jobId = data?.jobId;
      if (jobId) {
        await this.processJob(jobId);
      }
    }, { concurrency: 1 });

    this.agenda.start().then(() => this.logger.log('Agenda processor started'));
  }

  private async processJob(jobId: string) {
    const job = await this.jobModel.findById(jobId);
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
