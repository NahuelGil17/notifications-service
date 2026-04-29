import { Injectable, NotFoundException, Inject, OnModuleInit, Optional } from '@nestjs/common';
import { INotificationChannel, CHANNEL_TOKEN } from './inotification-channel';

@Injectable()
export class ChannelRegistry implements OnModuleInit {
  private channels = new Map<string, INotificationChannel>();

  constructor(
    @Optional() @Inject(CHANNEL_TOKEN) private injectedChannels: INotificationChannel[] = [],
  ) {}

  onModuleInit() {
    // Automatically register injected channels
    if (this.injectedChannels && Array.isArray(this.injectedChannels)) {
      this.injectedChannels.forEach(channel => this.register(channel));
    }
  }

  register(channel: INotificationChannel) {
    this.channels.set(channel.key, channel);
  }

  get(key: string): INotificationChannel {
    const channel = this.channels.get(key);
    if (!channel) {
      throw new NotFoundException(`Notification channel "${key}" not found`);
    }
    return channel;
  }

  list(): string[] {
    return Array.from(this.channels.keys());
  }
}
