import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhatsAppKeyDocument = WhatsAppKey & Document;

@Schema({ collection: 'whatsapp_keys' })
export class WhatsAppKey {
  @Prop({ required: true, unique: true })
  keyId!: string; // Format: session:category:id

  @Prop({ type: Object, required: true })
  data: any;
}

export const WhatsAppKeySchema = SchemaFactory.createForClass(WhatsAppKey);
