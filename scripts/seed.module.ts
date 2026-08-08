import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { validateEnv, EnvVars } from '../src/config/env.validation';
import { ApiKeysModule } from '../src/contexts/api-keys/api-keys.module';

/**
 * Minimal context for CLI scripts: config + Mongo + api keys, nothing else.
 *
 * Booting the full AppModule for a one-row write also started Baileys and
 * Agenda. Those keep handles on the event loop, so the script never exited
 * after app.close() — leaving a background process whose mongoose connection
 * was closed but whose Agenda kept polling and locking dispatch jobs, which
 * then failed with "Client must be connected before running operations".
 */
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
    ApiKeysModule,
  ],
})
export class SeedModule {}
