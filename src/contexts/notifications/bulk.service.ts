import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Agenda } from 'agenda';
import { ConfigService } from '@nestjs/config';
import { Batch, BatchDocument, BatchStatus } from './batch.schema';
import { Job, JobDocument, JobStatus } from './job.schema';
import { CsvRow } from './csv-parser.service';
import { EnvVars } from '../../config/env.validation';

@Injectable()
export class BulkService {
  private readonly logger = new Logger(BulkService.name);

  constructor(
    @InjectModel(Batch.name) private batchModel: Model<BatchDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @Inject('AGENDA') private agenda: Agenda,
    private configService: ConfigService<EnvVars, true>,
  ) {}

  async enqueue(fileName: string, rows: CsvRow[], apiKeyName: string, correlationId?: string) {
    const batch = await this.batchModel.create({
      fileName,
      totalRows: rows.length,
      apiKeyName,
      correlationId,
      status: BatchStatus.PROCESSING,
    });

    const delayMin = this.configService.get('DELAY_MIN_MS', { infer: true });
    const delayMax = this.configService.get('DELAY_MAX_MS', { infer: true });

    let cumulativeDelay = 0;
    const jobs: JobDocument[] = [];

    for (const row of rows) {
      // Random delay between rows (cumulative)
      const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      cumulativeDelay += randomDelay;
      
      const scheduledFor = new Date(Date.now() + cumulativeDelay);

      this.logger.log(`Scheduling notification to ${row.to} for ${scheduledFor.toISOString()} (delay: ${randomDelay}ms, total offset: ${cumulativeDelay}ms)`);

      const job = await this.jobModel.create({
        batchId: batch._id as Types.ObjectId,
        to: row.to,
        message: row.message,
        channel: 'whatsapp', // Default for now
        status: JobStatus.QUEUED,
        scheduledFor,
      });

      // Schedule in Agenda
      await this.agenda.schedule(scheduledFor, 'notifications.dispatch', { 
        jobId: job._id.toString() 
      });

      jobs.push(job);
    }

    return {
      batchId: batch._id,
      total: rows.length,
    };
  }

  /**
   * File-less bulk send: same Batch/Job/Agenda pipeline as the CSV path, fed
   * directly with phones + one message. Jobs are bulk-inserted instead of
   * created one await at a time — the serial insert is what forced the CSV
   * flow to cap files at 45 recipients to stay inside the proxy timeout.
   */
  async enqueueDirect(to: string[], message: string, apiKeyName: string, correlationId?: string) {
    const recipients = [...new Set(to)];

    const maxRows = this.configService.get('BULK_MAX_ROWS', { infer: true });
    if (recipients.length > maxRows) {
      throw new BadRequestException(`Recipient list exceeds maximum of ${maxRows} rows`);
    }

    const batch = await this.batchModel.create({
      fileName: 'direct-send',
      totalRows: recipients.length,
      apiKeyName,
      correlationId,
      status: BatchStatus.PROCESSING,
    });

    const delayMin = this.configService.get('DELAY_MIN_MS', { infer: true });
    const delayMax = this.configService.get('DELAY_MAX_MS', { infer: true });

    // Same anti-burst spacing as the CSV path: cumulative random delays so the
    // messages trickle out instead of leaving in one blast.
    const now = Date.now();
    let cumulativeDelay = 0;
    const jobDocs = recipients.map((recipient) => {
      cumulativeDelay += Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      return {
        batchId: batch._id as Types.ObjectId,
        to: recipient,
        message,
        channel: 'whatsapp',
        status: JobStatus.QUEUED,
        scheduledFor: new Date(now + cumulativeDelay),
      };
    });

    const jobs = await this.jobModel.insertMany(jobDocs);

    await Promise.all(
      jobs.map((job) =>
        this.agenda.schedule(job.scheduledFor, 'notifications.dispatch', {
          jobId: job._id.toString(),
        }),
      ),
    );

    this.logger.log(
      `Direct batch ${batch._id} enqueued: ${recipients.length} recipients over ${cumulativeDelay}ms`,
    );

    return {
      batchId: batch._id,
      total: recipients.length,
    };
  }

  async getBatch(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.batchModel.findById(id).exec();
  }

  async getJob(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.jobModel.findById(id).exec();
  }
}
