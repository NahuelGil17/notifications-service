import { Test, TestingModule } from '@nestjs/testing';
import { CsvParserService } from './csv-parser.service';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvParserService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(500),
          },
        },
      ],
    }).compile();

    service = module.get<CsvParserService>(CsvParserService);
  });

  it('should parse a valid CSV', async () => {
    const csvContent = 'to,message\n+59891234567,Hello\n+59891234568,World';
    const stream = Readable.from(csvContent);
    
    const rows = await service.parse(stream);
    
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ to: '+59891234567', message: 'Hello' });
  });

  it('should throw if columns are missing', async () => {
    const csvContent = 'to,wrong\n+59891234567,Hello';
    const stream = Readable.from(csvContent);
    
    await expect(service.parse(stream)).rejects.toThrow('missing "to" or "message" column');
  });

  it('should throw if max rows exceeded', async () => {
    const csvContent = 'to,message\n' + '+59891234567,Hello\n'.repeat(501);
    const stream = Readable.from(csvContent);
    
    await expect(service.parse(stream)).rejects.toThrow('exceeds maximum of 500 rows');
  });
});
