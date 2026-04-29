import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { BehaviorSubject, Subject } from 'rxjs';
import * as qrcode from 'qrcode-terminal';
import { WhatsAppSession, WhatsAppSessionDocument } from './wa-session.schema';
import { WhatsAppKey, WhatsAppKeyDocument } from './wa-key.schema';
import { useMongoAuthState } from './mongo-auth-state';

export enum WhatsAppStatus {
  INITIALIZING = 'initializing',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  QR_READY = 'qr_ready',
}

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('WhatsApp');
  private sock: any;
  private isClosing = false;
  
  public status$ = new BehaviorSubject<WhatsAppStatus>(WhatsAppStatus.INITIALIZING);
  public qr$ = new BehaviorSubject<string | null>(null);

  constructor(
    @InjectModel(WhatsAppSession.name) private sessionModel: Model<WhatsAppSessionDocument>,
    @InjectModel(WhatsAppKey.name) private keyModel: Model<WhatsAppKeyDocument>,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.isClosing = true;
    if (this.sock) {
      await this.sock.end();
    }
  }

  async connect() {
    if (this.isClosing) return;
    this.status$.next(WhatsAppStatus.CONNECTING);
    this.logger.log('Starting WhatsApp connection...');

    const { state, saveCreds } = await useMongoAuthState(this.sessionModel, this.keyModel);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: {
        creds: state.creds,
        keys: state.keys,
      },
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status$.next(WhatsAppStatus.QR_READY);
        this.qr$.next(qr);
        this.logger.log('New QR code received. Scan it below:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut && !this.isClosing;
        
        if (this.isClosing) {
          this.logger.log('WhatsApp connection closed gracefully');
          this.status$.next(WhatsAppStatus.DISCONNECTED);
          return;
        }

        this.logger.warn(`Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
        this.status$.next(WhatsAppStatus.DISCONNECTED);
        if (shouldReconnect) {
          this.connect();
        }
      } else if (connection === 'open') {
        this.logger.log('WhatsApp connection opened successfully');
        this.status$.next(WhatsAppStatus.CONNECTED);
        this.qr$.next(null); // Clear QR once connected
      }
    });
  }

  async logout() {
    if (this.sock) {
      await this.sock.logout();
      await this.sessionModel.deleteOne({ id: 'default' });
      this.status$.next(WhatsAppStatus.DISCONNECTED);
      this.connect(); // Restart to get a new QR
    }
  }

  getSocket() {
    return this.sock;
  }

  isConnected(): boolean {
    return this.status$.value === WhatsAppStatus.CONNECTED;
  }
}
