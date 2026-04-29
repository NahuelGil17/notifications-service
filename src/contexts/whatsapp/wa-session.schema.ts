import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhatsAppSessionDocument = WhatsAppSession & Document;

@Schema({ timestamps: true, collection: 'whatsapp_sessions' })
export class WhatsAppSession {
  @Prop({ required: true, default: 'default', unique: true })
  id!: string;

  @Prop({ type: Object })
  creds: any;

  @Prop({ default: Date.now })
  updatedAt!: Date;
}

export const WhatsAppSessionSchema = SchemaFactory.createForClass(WhatsAppSession);
