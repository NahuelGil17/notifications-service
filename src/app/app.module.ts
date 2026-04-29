import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { validateEnv, EnvVars } from '../config/env.validation';
import { AgendaModule } from '../config/agenda.module';
import { ApiKeysModule } from '../contexts/api-keys/api-keys.module';
import { ChannelsModule } from '../contexts/channels/channels.module';
import { WhatsAppModule } from '../contexts/whatsapp/whatsapp.module';
import { NotificationsModule } from '../contexts/notifications/notifications.module';
import { CorrelationIdMiddleware } from '../shared/middleware/correlation-id.middleware';
import { LoggerMiddleware } from '../shared/middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => validateEnv(config),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        uri: config.get('MONGO_URI', { infer: true }),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AgendaModule,
    ApiKeysModule,
    ChannelsModule,
    WhatsAppModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, LoggerMiddleware)
      .forRoutes('*');
  }
}
