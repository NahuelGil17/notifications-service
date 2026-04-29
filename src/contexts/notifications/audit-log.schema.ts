import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ collection: 'auditlogs', timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ required: true })
  channel!: string;

  @Prop({ required: true })
  to!: string; // Will be masked in logs, but maybe stored full here? Usually audit needs full? Design says "scrub phones in logs". I'll store masked for privacy if required.

  @Prop({ required: true })
  status!: 'success' | 'failure';

  @Prop()
  providerMessageId?: string;

  @Prop()
  error?: string;

  @Prop({ type: Object })
  metadata?: any;

  @Prop()
  correlationId?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
