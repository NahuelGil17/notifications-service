import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { BulkDirectDto } from './bulk-direct.dto';

/**
 * The DTO spec validates the class directly. This one runs bodies through the
 * SAME ValidationPipe main.ts installs, because `whitelist` and
 * `forbidNonWhitelisted` reject shapes that plain validate() happily accepts —
 * a gap that let a new optional property look valid in tests while the real
 * endpoint answered "property items should not exist".
 */
describe('BulkDirectDto through the global ValidationPipe', () => {
  // Mirrors main.ts exactly.
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const metadata = {
    type: 'body' as const,
    metatype: BulkDirectDto,
    data: '',
  };

  const run = (body: unknown) => pipe.transform(body, metadata);

  it('accepts the shared-message shape', async () => {
    const result = await run({ to: ['+59891234567'], message: 'Hola' });

    expect(result.to).toEqual(['+59891234567']);
    expect(result.message).toBe('Hola');
  });

  it('accepts the personalized items shape', async () => {
    const items = [
      { to: '+59891234567', message: 'Hola Ana' },
      { to: '+59891234568', message: 'Hola Beto' },
    ];

    const result = await run({ items });

    expect(result.items).toEqual(items);
    expect(result.to).toBeUndefined();
    expect(result.message).toBeUndefined();
  });

  it('keeps line breaks inside a personalized message', async () => {
    const message = ['Hola Ana', '', '- Corremos el sabado'].join('\n');

    const result = await run({ items: [{ to: '+59891234567', message }] });

    expect(result.items[0].message).toBe(message);
  });

  it('rejects an unknown property, the whitelist contract', async () => {
    await expect(
      run({ to: ['+59891234567'], message: 'Hola', extra: 'nope' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a body carrying both shapes', async () => {
    await expect(
      run({
        items: [{ to: '+59891234567', message: 'Hola Ana' }],
        to: ['+59891234568'],
        message: 'Hola',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an item whose phone is not E.164', async () => {
    await expect(run({ items: [{ to: '099123456', message: 'Hola' }] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty body', async () => {
    await expect(run({})).rejects.toThrow(BadRequestException);
  });
});
