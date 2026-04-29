import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppChannel } from './whatsapp.channel';
import { WhatsAppSession, WhatsAppSessionSchema } from './wa-session.schema';
import { WhatsAppKey, WhatsAppKeySchema } from './wa-key.schema';
import { CHANNEL_TOKEN } from '../channels/inotification-channel';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ChannelRegistry } from '../channels/channel.registry';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppSession.name, schema: WhatsAppSessionSchema },
      { name: WhatsAppKey.name, schema: WhatsAppKeySchema },
    ]),
    ApiKeysModule,
  ],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppChannel,
    {
      provide: CHANNEL_TOKEN,
      useExisting: WhatsAppChannel,
    },
  ],
  exports: [WhatsAppService, WhatsAppChannel],
})
export class WhatsAppModule implements OnModuleInit {
  constructor(
    private readonly registry: ChannelRegistry,
    private readonly whatsappChannel: WhatsAppChannel,
  ) {}

  onModuleInit() {
    this.registry.register(this.whatsappChannel);
  }
}
