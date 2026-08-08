import { Module, Global, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { EnvVars } from './env.validation';

@Global()
@Module({
  providers: [
    {
      provide: 'AGENDA',
      inject: [ConfigService],
      useFactory: async (config: ConfigService<EnvVars, true>) => {
        const mongoUri = config.get('MONGO_URI', { infer: true });
        
        return new Agenda({
          backend: new MongoBackend({
            address: mongoUri,
            collection: 'agenda_jobs',
          }),
          processEvery: 5000, // 5 seconds in ms
          defaultConcurrency: 1,
          maxConcurrency: 1,
        });
      },
    },
  ],
  exports: ['AGENDA'],
})
export class AgendaModule implements OnModuleDestroy {
  private readonly logger = new Logger(AgendaModule.name);

  constructor(@Inject('AGENDA') private readonly agenda: Agenda) {}

  /**
   * Agenda polls on its own MongoClient, which Nest's shutdown does not close.
   * Without an explicit stop it keeps claiming jobs while the Mongoose
   * connection is already closing, and those jobs fail with
   * "Client must be connected before running operations".
   */
  async onModuleDestroy() {
    try {
      await this.agenda.stop();
      this.logger.log('Agenda stopped');
    } catch (error: any) {
      this.logger.error(`Failed to stop Agenda cleanly: ${error?.message}`);
    }
  }
}
