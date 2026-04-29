import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INotificationChannel, NotificationResult } from '../channels/inotification-channel';
import { WhatsAppService } from './whatsapp.service';
import { EnvVars } from '../../config/env.validation';
import CircuitBreaker from 'opossum';

@Injectable()
export class WhatsAppChannel implements INotificationChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);
  private breaker: CircuitBreaker;

  public readonly key = 'whatsapp';

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly configService: ConfigService<EnvVars, true>,
  ) {
    const threshold = this.configService.get('CB_WHATSAPP_THRESHOLD_PCT', { infer: true });
    const resetTimeout = this.configService.get('CB_WHATSAPP_RESET_TIMEOUT_MS', { infer: true });

    this.breaker = new CircuitBreaker(this.sendInternal.bind(this), {
      errorThresholdPercentage: threshold,
      resetTimeout: resetTimeout,
    });

    this.breaker.on('open', () => this.logger.warn('WhatsApp Circuit Breaker OPEN'));
    this.breaker.on('halfOpen', () => this.logger.log('WhatsApp Circuit Breaker HALF_OPEN'));
    this.breaker.on('close', () => this.logger.log('WhatsApp Circuit Breaker CLOSED'));
  }

  async send(to: string, message: string): Promise<NotificationResult> {
    return this.breaker.fire(to, message);
  }

  private async sendInternal(to: string, message: string): Promise<NotificationResult> {
    if (!this.whatsappService.isConnected()) {
      throw new Error('WhatsApp service is not connected');
    }

    const sock = this.whatsappService.getSocket();
    const jid = `${to.replace(/\D/g, '')}@s.whatsapp.net`;

    const result = await sock.sendMessage(jid, { text: message });

    return {
      providerMessageId: result.key.id,
      sentAt: new Date(),
      metadata: { jid },
    };
  }

  healthy(): boolean {
    return !this.breaker.opened && this.whatsappService.isConnected();
  }
}
