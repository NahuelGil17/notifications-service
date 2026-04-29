import { Module, Global } from '@nestjs/common';
import { ChannelRegistry } from './channel.registry';

@Global()
@Module({
  providers: [ChannelRegistry],
  exports: [ChannelRegistry],
})
export class ChannelsModule {}
