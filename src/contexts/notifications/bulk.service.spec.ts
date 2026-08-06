import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect, Connection, Model } from 'mongoose';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { BulkService } from './bulk.service';
import { Batch, BatchSchema, BatchStatus } from './batch.schema';
import { Job, JobSchema, JobStatus } from './job.schema';

/**
 * enqueueDirect is the file-less bulk path: it receives phones + message as
 * JSON instead of a CSV, but must land in the exact same Batch/Job/Agenda
 * pipeline the dispatcher already processes. Jobs are bulk-inserted so a
 * 500-recipient campaign no longer needs one round trip per row — that serial
 * insert is why the CSV path forced 45-recipient files.
 */
describe('BulkService.enqueueDirect (Integration)', () => {
  let service: BulkService;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let batchModel: Model<Batch>;
  let jobModel: Model<Job>;

  const MAX_ROWS = 5;
  const DELAY_MS = 1000; // min = max -> deterministic spacing

  const mockAgenda = {
    schedule: vi.fn().mockResolvedValue({}),
  };

  const MULTILINE_MESSAGE = [
    '*PLUSFIT A CORRER!!!*',
    '',
    '- Todos vamos por los 7 km',
  ].join('\n');

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    mongoConnection = (await connect(mongod.getUri())).connection;
    batchModel = mongoConnection.model(Batch.name, BatchSchema);
    jobModel = mongoConnection.model(Job.name, JobSchema);
  }, 120000);

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkService,
        { provide: getModelToken(Batch.name), useValue: batchModel },
        { provide: getModelToken(Job.name), useValue: jobModel },
        { provide: 'AGENDA', useValue: mockAgenda },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockImplementation((key: string) => {
              if (key === 'BULK_MAX_ROWS') return MAX_ROWS;
              if (key === 'DELAY_MIN_MS') return DELAY_MS;
              if (key === 'DELAY_MAX_MS') return DELAY_MS;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BulkService>(BulkService);
  });

  afterEach(async () => {
    await batchModel.deleteMany({});
    await jobModel.deleteMany({});
    vi.clearAllMocks();
  });

  it('creates a processing batch that the existing status endpoint can track', async () => {
    const result = await service.enqueueDirect(
      ['+59891234567', '+59891234568'],
      'Hola',
      'gym-backend',
      'corr-1',
    );

    expect(result.total).toBe(2);
    expect(result.batchId).toBeDefined();

    const batch = await batchModel.findById(result.batchId);
    expect(batch).toBeDefined();
    expect(batch?.status).toBe(BatchStatus.PROCESSING);
    expect(batch?.totalRows).toBe(2);
    expect(batch?.apiKeyName).toBe('gym-backend');
    expect(batch?.correlationId).toBe('corr-1');
  });

  it('creates one queued whatsapp job per recipient, all with the same message', async () => {
    const result = await service.enqueueDirect(
      ['+59891234567', '+59891234568', '+59891234569'],
      MULTILINE_MESSAGE,
      'gym-backend',
    );

    const jobs = await jobModel.find({ batchId: result.batchId }).sort({ scheduledFor: 1 });

    expect(jobs).toHaveLength(3);
    expect(jobs.map((job) => job.to)).toEqual([
      '+59891234567',
      '+59891234568',
      '+59891234569',
    ]);
    for (const job of jobs) {
      expect(job.status).toBe(JobStatus.QUEUED);
      expect(job.channel).toBe('whatsapp');
      expect(job.message).toBe(MULTILINE_MESSAGE);
    }
  });

  it('schedules every job in agenda under the dispatch the worker listens to', async () => {
    const result = await service.enqueueDirect(
      ['+59891234567', '+59891234568'],
      'Hola',
      'gym-backend',
    );

    expect(mockAgenda.schedule).toHaveBeenCalledTimes(2);

    const jobs = await jobModel.find({ batchId: result.batchId });
    for (const job of jobs) {
      expect(mockAgenda.schedule).toHaveBeenCalledWith(
        job.scheduledFor,
        'notifications.dispatch',
        { jobId: job._id.toString() },
      );
    }
  });

  /**
   * Messages must not leave all at once: WhatsApp flags accounts that blast N
   * identical messages in the same second. The CSV path spaces rows with a
   * cumulative random delay, and the direct path must keep that behavior.
   */
  it('spaces recipients with cumulative delays like the CSV path', async () => {
    const before = Date.now();
    const result = await service.enqueueDirect(
      ['+59891234567', '+59891234568', '+59891234569'],
      'Hola',
      'gym-backend',
    );

    const jobs = await jobModel.find({ batchId: result.batchId }).sort({ scheduledFor: 1 });
    const times = jobs.map((job) => job.scheduledFor.getTime());

    // With min = max = 1000 the spacing is exactly 1s between consecutive jobs.
    expect(times[1] - times[0]).toBe(DELAY_MS);
    expect(times[2] - times[1]).toBe(DELAY_MS);
    expect(times[0]).toBeGreaterThanOrEqual(before + DELAY_MS);
  });

  it('deduplicates repeated phones so nobody gets the campaign twice', async () => {
    const result = await service.enqueueDirect(
      ['+59891234567', '+59891234567', '+59891234568'],
      'Hola',
      'gym-backend',
    );

    expect(result.total).toBe(2);

    const batch = await batchModel.findById(result.batchId);
    expect(batch?.totalRows).toBe(2);

    const jobs = await jobModel.find({ batchId: result.batchId });
    expect(jobs).toHaveLength(2);
  });

  it('rejects a list over BULK_MAX_ROWS without creating anything', async () => {
    const to = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `+5989123456${i}`);

    await expect(service.enqueueDirect(to, 'Hola', 'gym-backend')).rejects.toThrow(
      `exceeds maximum of ${MAX_ROWS}`,
    );

    expect(await batchModel.countDocuments({})).toBe(0);
    expect(await jobModel.countDocuments({})).toBe(0);
    expect(mockAgenda.schedule).not.toHaveBeenCalled();
  });

  it('counts the limit against unique recipients, not raw list length', async () => {
    // 6 entries but only 5 unique -> within the limit of 5.
    const to = [
      '+59891234561',
      '+59891234561',
      '+59891234562',
      '+59891234563',
      '+59891234564',
      '+59891234565',
    ];

    const result = await service.enqueueDirect(to, 'Hola', 'gym-backend');

    expect(result.total).toBe(5);
  });
});
