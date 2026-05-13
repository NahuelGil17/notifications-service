import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app/app.module';
import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/health (GET)', () => {
    return app
      .inject({
        method: 'GET',
        url: '/health',
      })
      .then((res) => {
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.payload)).toMatchObject({
          status: 'ok',
          service: 'notifications-service',
        });
      });
  });

  it('/notifications/send (POST) - Unauthorized', () => {
    return app
      .inject({
        method: 'POST',
        url: '/notifications/send',
        payload: {
          channel: 'whatsapp',
          to: '+59891234567',
          message: 'Hello',
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(401);
      });
  });
});
