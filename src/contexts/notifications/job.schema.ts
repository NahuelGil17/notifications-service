import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JobDocument = Job & Document;

export enum JobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  DISPATCHED = 'dispatched',
  FAILED = 'failed',
  CANCELLED_DAILY_CAP = 'cancelled_daily_cap',
}

@Schema({ timestamps: true })
export class Job {
  @Prop({ type: Types.ObjectId, ref: 'Batch', required: false })
  batchId?: Types.ObjectId;

  @Prop({ required: true })
  to!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ required: true })
  channel!: string;

  @Prop({ type: String, enum: JobStatus, default: JobStatus.PENDING })
  status!: JobStatus;

  @Prop()
  scheduledFor!: Date;

  @Prop()
  processedAt?: Date;

  @Prop()
  providerMessageId?: string;

  @Prop()
  error?: string;
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.index({ batchId: 1 });
JobSchema.index({ status: 1 });
JobSchema.index({ scheduledFor: 1 });
