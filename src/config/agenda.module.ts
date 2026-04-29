import { Module, Global, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
export class AgendaModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {}
  
  async onModuleInit() {
    // Start logic will be in DispatchProcessor
  }

  async onModuleDestroy() {
    // Graceful shutdown logic could be added here
  }
}
