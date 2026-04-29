import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { BulkService } from './bulk.service';
import { CsvParserService } from './csv-parser.service';
import { DispatchProcessor } from './dispatch-processor';
import { DailyCap, DailyCapSchema } from './daily-cap.schema';
import { AuditLog, AuditLogSchema } from './audit-log.schema';
import { Batch, BatchSchema } from './batch.schema';
import { Job, JobSchema } from './job.schema';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyCap.name, schema: DailyCapSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Batch.name, schema: BatchSchema },
      { name: Job.name, schema: JobSchema },
    ]),
    ApiKeysModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    BulkService,
    CsvParserService,
    DispatchProcessor,
  ],
  exports: [NotificationsService, BulkService, MongooseModule],
})
export class NotificationsModule {}
