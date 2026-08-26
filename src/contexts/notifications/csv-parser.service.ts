import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../../config/env.validation';

export interface CsvRow {
  to: string;
  message: string;
}

@Injectable()
export class CsvParserService {
  constructor(private configService: ConfigService<EnvVars, true>) {}

  async parse(stream: Readable): Promise<CsvRow[]> {
    const maxRows = this.configService.get('BULK_MAX_ROWS', { infer: true });
    const rows: CsvRow[] = [];
    
    const parser = stream.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: [',', ';'],
        // Excel writes a UTF-8 BOM when it saves a CSV. Without this the first
        // column is named "﻿to", so every row looks like it is missing the
        // "to" column and the whole upload is rejected.
        bom: true,
      })
    );

    let rowCount = 0;
    for await (const record of parser) {
      rowCount++;
      if (rowCount > maxRows) {
        throw new BadRequestException(`CSV exceeds maximum of ${maxRows} rows`);
      }

      const row = this.validateRow(record, rowCount);
      rows.push(row);
    }

    if (rows.length === 0) {
      throw new BadRequestException('CSV is empty');
    }

    return rows;
  }

  private validateRow(record: any, index: number): CsvRow {
    const { to, message } = record;

    if (!to || !message) {
      throw new BadRequestException(`Row ${index} is missing "to" or "message" column`);
    }

    // Basic E.164 check (more thorough validation will happen in NotificationsService/Channel)
    if (!/^\+[1-9]\d{1,14}$/.test(to)) {
      throw new BadRequestException(`Row ${index} has invalid phone format: ${to}`);
    }

    // Windows tools save CSV with CRLF and csv-parse keeps the CR when it sits
    // inside a quoted field. WhatsApp has no use for a carriage return, so the
    // message is normalized to LF before it is queued for delivery.
    return { to, message: String(message).replace(/\r\n?/g, '\n') };
  }
}
