import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BatchDocument = Batch & Document;

export enum BatchStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Batch {
  @Prop({ required: true })
  fileName!: string;

  @Prop({ required: true })
  totalRows!: number;

  @Prop({ default: 0 })
  processedRows!: number;

  @Prop({ default: 0 })
  successCount!: number;

  @Prop({ default: 0 })
  failureCount!: number;

  @Prop({ type: String, enum: BatchStatus, default: BatchStatus.PENDING })
  status!: BatchStatus;

  @Prop()
  apiKeyName!: string;

  @Prop()
  correlationId?: string;
}

export const BatchSchema = SchemaFactory.createForClass(Batch);
