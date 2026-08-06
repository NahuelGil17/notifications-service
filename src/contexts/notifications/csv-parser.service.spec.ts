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

  /**
   * Campaign messages keep their line breaks, which is only legal inside a
   * quoted CSV field. These cover the shapes a real export produces plus the
   * ones a user creates by opening that export in Excel or Google Sheets.
   */
  describe('multiline messages', () => {
    const MULTILINE = '*PLUSFIT A CORRER!!!*\n\n- Todos vamos por los 7 km\n- Medallas';
    const BYTE_ORDER_MARK = '﻿';

    async function parseCsv(content: string) {
      return service.parse(Readable.from(content));
    }

    it('keeps every line break of a quoted message', async () => {
      const rows = await parseCsv(`to,message\n+59891234567,"${MULTILINE}"`);

      expect(rows).toHaveLength(1);
      expect(rows[0].message).toBe(MULTILINE);
    });

    it('reads one row per recipient, not one per line', async () => {
      const row = `+59891234567,"${MULTILINE}"`;
      const rows = await parseCsv(['to,message', row, row, row].join('\n'));

      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.message === MULTILINE)).toBe(true);
    });

    /**
     * Excel prepends a UTF-8 BOM on save. Without bom: true the first column is
     * named "﻿to", so every row looks like it is missing the "to" column.
     */
    it('accepts a file that Excel saved with a UTF-8 BOM', async () => {
      const rows = await parseCsv(`${BYTE_ORDER_MARK}to,message\n+59891234567,"${MULTILINE}"`);

      expect(rows).toHaveLength(1);
      expect(rows[0].to).toBe('+59891234567');
      expect(rows[0].message).toBe(MULTILINE);
    });

    it('accepts a CRLF file with a multiline message', async () => {
      const rows = await parseCsv(`to,message\r\n+59891234567,"${MULTILINE}"`);

      expect(rows[0].message).toBe(MULTILINE);
    });

    /**
     * Excel and Notepad save with CRLF, and csv-parse keeps the CR when it sits
     * inside a quoted field. Left alone, the body reaching WhatsApp carries
     * stray carriage returns and stops matching what the gym backend validated.
     */
    it('normalizes CRLF inside the message to plain line breaks', async () => {
      const crlfMessage = MULTILINE.replace(/\n/g, '\r\n');

      const rows = await parseCsv(`to,message\r\n+59891234567,"${crlfMessage}"`);

      expect(rows[0].message).toBe(MULTILINE);
      expect(rows[0].message).not.toContain('\r');
    });

    it('normalizes a lone CR inside the message', async () => {
      const rows = await parseCsv('to,message\n+59891234567,"uno\rdos"');

      expect(rows[0].message).toBe('uno\ndos');
    });

    it('keeps commas and semicolons that live inside the message', async () => {
      const rows = await parseCsv('to,message\n+59891234567,"uno, dos; tres"');

      expect(rows).toHaveLength(1);
      expect(rows[0].message).toBe('uno, dos; tres');
    });

    it('keeps quotes the exporter escaped', async () => {
      const rows = await parseCsv('to,message\n+59891234567,"di ""hola"" fuerte"');

      expect(rows[0].message).toBe('di "hola" fuerte');
    });

    it('ignores a trailing newline after the last recipient', async () => {
      const rows = await parseCsv(`to,message\n+59891234567,"${MULTILINE}"\n`);

      expect(rows).toHaveLength(1);
    });

    it('still rejects a row whose phone is not E.164', async () => {
      await expect(parseCsv(`to,message\n099123456,"${MULTILINE}"`)).rejects.toThrow(
        'invalid phone format',
      );
    });
  });

  describe('simple messages', () => {
    it('parses a one-word message', async () => {
      const rows = await service.parse(Readable.from('to,message\n+59891234567,Hola'));

      expect(rows[0]).toEqual({ to: '+59891234567', message: 'Hola' });
    });

    it('parses an unquoted message with spaces', async () => {
      const rows = await service.parse(
        Readable.from('to,message\n+59891234567,Hola como estas'),
      );

      expect(rows[0].message).toBe('Hola como estas');
    });

    it('parses a quoted single-line message', async () => {
      const rows = await service.parse(Readable.from('to,message\n+59891234567,"Hola"'));

      expect(rows[0].message).toBe('Hola');
    });

    it('parses many single-line recipients', async () => {
      const rows = await service.parse(
        Readable.from(
          ['to,message', '+59891234567,Hola', '+59891234568,Chau', '+59891234569,Buenas'].join(
            '\n',
          ),
        ),
      );

      expect(rows.map((r) => r.message)).toEqual(['Hola', 'Chau', 'Buenas']);
    });

    it('rejects a row with no message', async () => {
      await expect(
        service.parse(Readable.from('to,message\n+59891234567,')),
      ).rejects.toThrow('is missing "to" or "message" column');
    });
  });
});
