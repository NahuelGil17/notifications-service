import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApiKeyDocument = ApiKey & Document;

@Schema({ timestamps: true })
export class ApiKey {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true })
  hash!: string;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
