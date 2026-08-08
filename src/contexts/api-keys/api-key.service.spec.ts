import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect, Connection, Model } from 'mongoose';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { ApiKeyService } from './api-key.service';
import { ApiKey, ApiKeySchema } from './api-key.schema';

/**
 * rotate() backs the seed script's --force flag. The `name` field is unique, so
 * re-seeding an existing name has to replace the document rather than add a
 * second one. Replacing also keeps verify() cheap: it argon2-checks every
 * enabled key in sequence, so dead keys left behind would tax every request.
 */
describe('ApiKeyService.rotate (Integration)', () => {
  let service: ApiKeyService;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let apiKeyModel: Model<ApiKey>;

  const PEPPER = 'test-pepper-at-least-16-chars';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    mongoConnection = (await connect(mongod.getUri())).connection;
    apiKeyModel = mongoConnection.model(ApiKey.name, ApiKeySchema);
  }, 120000);

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await apiKeyModel.deleteMany({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: getModelToken(ApiKey.name), useValue: apiKeyModel },
        {
          provide: ConfigService,
          useValue: { get: () => PEPPER },
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  it('replaces the existing key of the same name instead of adding a second one', async () => {
    const { rawKey: oldKey } = await service.generate('backend-gym', ['send']);

    const { rawKey: newKey } = await service.rotate('backend-gym', [
      'send',
      'bulk',
      'admin',
    ]);

    const stored = await apiKeyModel.find({ name: 'backend-gym' });
    expect(stored).toHaveLength(1);
    expect(stored[0].scopes).toEqual(['send', 'bulk', 'admin']);
    expect(newKey).not.toBe(oldKey);
  });

  it('invalidates the previous raw key and accepts the new one', async () => {
    const { rawKey: oldKey } = await service.generate('backend-gym', ['send']);
    const { rawKey: newKey } = await service.rotate('backend-gym', ['send']);

    await expect(service.verify(oldKey)).rejects.toThrow('Invalid API Key');

    const verified = await service.verify(newKey);
    expect(verified.name).toBe('backend-gym');
  });

  it('creates the key when no key of that name exists yet', async () => {
    const { rawKey } = await service.rotate('brand-new', ['admin']);

    const verified = await service.verify(rawKey);
    expect(verified.name).toBe('brand-new');
    expect(verified.scopes).toEqual(['admin']);
  });
});
