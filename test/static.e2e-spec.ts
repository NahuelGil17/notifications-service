import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app/app.module';
import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import fastifyStatic from '@fastify/static';

describe('Static Assets (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Ensure public dir and test file exist for the test to have something to find
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }
    fs.writeFileSync(path.join(publicDir, 'test-static.html'), '<html><body>Static Test</body></html>');
  });

  afterAll(async () => {
    if (app) await app.close();
    // Cleanup
    const testFile = path.join(process.cwd(), 'public', 'test-static.html');
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyStatic, {
      root: path.join(__dirname, '..', 'public'),
      prefix: '/',
    });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/test-static.html (GET) should return 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-static.html',
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain('Static Test');
  });

  it('/qr-test.html (GET) should return 200 and contain UI elements', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/qr-test.html',
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain('WhatsApp QR Test');
    expect(res.payload).toContain('id="apiKey"');
    expect(res.payload).toContain('id="qrcode"');
  });

  it('/non-existent.html (GET) should return 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/non-existent.html',
    });
    expect(res.statusCode).toBe(404);
  });
});
