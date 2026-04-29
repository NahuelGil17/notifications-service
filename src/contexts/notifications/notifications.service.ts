import { Injectable, HttpException, HttpStatus, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Agenda } from 'agenda';
import { DailyCap, DailyCapDocument } from './daily-cap.schema';
import { AuditLog, AuditLogDocument } from './audit-log.schema';
import { Job, JobDocument, JobStatus } from './job.schema';
import { ChannelRegistry } from '../channels/channel.registry';
import { SendNotificationDto } from './dtos/send.dto';
import { EnvVars } from '../../config/env.validation';
import { PhoneUtil } from '../../shared/utils/phone.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(DailyCap.name) private dailyCapModel: Model<DailyCapDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @Inject('AGENDA') private agenda: Agenda,
    private channelRegistry: ChannelRegistry,
    private configService: ConfigService<EnvVars, true>,
  ) {}

  async send(dto: SendNotificationDto, correlationId?: string) {
    // Normalize phone number
    dto.to = PhoneUtil.normalize(dto.to);

    const delayMin = this.configService.get('DELAY_MIN_MS', { infer: true });
    const delayMax = this.configService.get('DELAY_MAX_MS', { infer: true });

    const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
    const scheduledFor = new Date(Date.now() + randomDelay);

    this.logger.log(`Enqueuing individual notification to ${PhoneUtil.mask(dto.to)} for ${scheduledFor.toISOString()} (delay: ${randomDelay}ms)`);

    const job = await this.jobModel.create({
      to: dto.to,
      message: dto.message,
      channel: dto.channel,
      status: JobStatus.QUEUED,
      scheduledFor,
    });

    // Schedule in Agenda
    await this.agenda.schedule(scheduledFor, 'notifications.dispatch', { 
      jobId: job._id.toString() 
    });

    return {
      jobId: job._id.toString(),
      status: 'queued',
      scheduledFor,
    };
  }

  async dispatch(dto: SendNotificationDto, correlationId?: string) {
    // Normalize phone number (already done in send, but safe for worker use)
    dto.to = PhoneUtil.normalize(dto.to);

    await this.checkDailyCap();

    const channel = this.channelRegistry.get(dto.channel);
    
    try {
      const result = await channel.send(dto.to, dto.message);
      
      await this.incrementDailyCap();
      await this.logAudit('success', dto, correlationId, result.providerMessageId, result.metadata);

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to send notification via ${dto.channel} to ${PhoneUtil.mask(dto.to)}: ${error?.message || 'Unknown error'}`);
      await this.logAudit('failure', dto, correlationId, undefined, { error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  async getHistory(query: { correlationId?: string; status?: string; page?: number; limit?: number }) {
    const { correlationId, status, page = 1, limit = 20 } = query;
    const filter: any = {};

    if (correlationId) filter.correlationId = correlationId;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    this.logger.log(`Fetching history with filter: ${JSON.stringify(filter)}, skip: ${skip}, limit: ${limit}`);

    const [items, total] = await Promise.all([
      this.auditLogModel.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);

    this.logger.log(`Query results - Total docs in DB: ${total}, Items found in this page: ${items.length}`);
    if (items.length === 0 && total > 0) {
      this.logger.warn(`Potential pagination issue: total is ${total} but items are empty for skip ${skip} and limit ${limit}`);
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async mongoTest() {
    const collections = await this.auditLogModel.db.db.listCollections().toArray();
    const rawDocs = await this.auditLogModel.db.db.collection('auditlogs').find({}).limit(5).toArray();
    const modelDocs = await this.auditLogModel.find({}).limit(5).exec();
    
    return {
      dbName: this.auditLogModel.db.name,
      collections: collections.map(c => c.name),
      rawDocsCountInAuditLogs: await this.auditLogModel.db.db.collection('auditlogs').countDocuments(),
      sampleRawDocs: rawDocs,
      sampleModelDocs: modelDocs,
    };
  }

  private async checkDailyCap() {

    const dailyCap = this.configService.get('DAILY_CAP', { infer: true });
    const today = new Date().toISOString().split('T')[0];

    const cap = await this.dailyCapModel.findOne({ day: today });
    if (cap && cap.count >= dailyCap) {
      throw new HttpException('Daily message cap reached', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async incrementDailyCap() {
    const today = new Date().toISOString().split('T')[0];
    await this.dailyCapModel.updateOne(
      { day: today },
      { $inc: { count: 1 } },
      { upsert: true }
    );
  }

  private async logAudit(
    status: 'success' | 'failure',
    dto: SendNotificationDto,
    correlationId?: string,
    providerMessageId?: string,
    metadata?: any,
  ) {
    const maskedTo = PhoneUtil.mask(dto.to);
    
    await this.auditLogModel.create({
      channel: dto.channel,
      to: maskedTo,
      status,
      providerMessageId,
      correlationId,
      metadata,
    });
  }
}
