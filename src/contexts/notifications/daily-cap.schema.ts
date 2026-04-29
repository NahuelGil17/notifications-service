import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyCapDocument = DailyCap & Document;

@Schema({ timestamps: true })
export class DailyCap {
  @Prop({ required: true, unique: true })
  day!: string; // YYYY-MM-DD

  @Prop({ default: 0 })
  count!: number;
}

export const DailyCapSchema = SchemaFactory.createForClass(DailyCap);
