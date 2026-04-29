export interface NotificationResult {
  providerMessageId?: string;
  sentAt: Date;
  metadata?: Record<string, any>;
}

export interface INotificationChannel {
  /** Unique key for the channel (e.g., 'whatsapp', 'email') */
  readonly key: string;

  /** Send a single notification */
  send(to: string, message: string): Promise<NotificationResult>;

  /** Check if the channel is healthy (e.g., circuit breaker status, connection) */
  healthy(): boolean;
}

export const CHANNEL_TOKEN = Symbol('CHANNEL_TOKEN');
