import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, it, expect } from 'vitest';
import { BulkDirectDto } from './bulk-direct.dto';

/**
 * Contract for the file-less bulk send. The gym backend posts a JSON body of
 * already-normalized E.164 phones plus one message, replacing the CSV
 * download/upload round trip that used to mangle multiline campaigns.
 */
describe('BulkDirectDto', () => {
  const MULTILINE_MESSAGE = [
    '*PLUSFIT A CORRER!!!*',
    '',
    '- Todos vamos por los 7 km',
    '- Medallas para todos',
  ].join('\n');

  async function validationErrorsOf(payload: Record<string, unknown>) {
    return validate(plainToInstance(BulkDirectDto, payload));
  }

  it('accepts a list of E.164 phones and a message', async () => {
    const errors = await validationErrorsOf({
      to: ['+59891234567', '+59891234568'],
      message: 'Hola',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a multiline campaign message', async () => {
    const errors = await validationErrorsOf({
      to: ['+59891234567'],
      message: MULTILINE_MESSAGE,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty recipient list', async () => {
    const errors = await validationErrorsOf({ to: [], message: 'Hola' });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('to');
  });

  it('rejects a missing recipient list', async () => {
    const errors = await validationErrorsOf({ message: 'Hola' });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('to');
  });

  it('rejects a phone that is not E.164', async () => {
    const errors = await validationErrorsOf({
      to: ['+59891234567', '099123456'],
      message: 'Hola',
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('to');
  });

  it('rejects a recipient that is not a string', async () => {
    const errors = await validationErrorsOf({
      to: ['+59891234567', 59891234568],
      message: 'Hola',
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('to');
  });

  it('rejects an empty message', async () => {
    const errors = await validationErrorsOf({ to: ['+59891234567'], message: '' });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('message');
  });

  it('rejects a whitespace-only message', async () => {
    const errors = await validationErrorsOf({ to: ['+59891234567'], message: '  \n  ' });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('message');
  });

  it('rejects a message longer than 4096 characters', async () => {
    const errors = await validationErrorsOf({
      to: ['+59891234567'],
      message: 'a'.repeat(4097),
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('message');
  });

  it('accepts a message of exactly 4096 characters', async () => {
    const errors = await validationErrorsOf({
      to: ['+59891234567'],
      message: 'a'.repeat(4096),
    });

    expect(errors).toHaveLength(0);
  });

  /**
   * Hard sanity ceiling against a runaway payload. The configurable
   * BULK_MAX_ROWS limit is enforced by BulkService, which knows the config;
   * the DTO only guards against something absurd reaching that far.
   */
  it('rejects more than 1000 recipients outright', async () => {
    const to = Array.from({ length: 1001 }, (_, i) => `+5989${String(i).padStart(7, '0')}`);

    const errors = await validationErrorsOf({ to, message: 'Hola' });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('to');
  });

  /**
   * Contract fixtures shared with the gym backend, which asserts these exact
   * values in its own bulk-send spec. They are duplicated on purpose: importing
   * across repos is not possible in either test runner, so the boundary is
   * pinned from both sides instead. If one side drifts, one suite goes red.
   */
  describe('the payload the gym backend actually posts', () => {
    /** Output of toUruguayE164 over the messy formats the gym database holds. */
    const GYM_NORMALIZED_PHONES = [
      '+59899123456',
      '+59899123457',
      '+59899123458',
      '+59899123459',
      '+59899123460',
      '+59899123461',
    ];

    /** Output of normalizeWhatsAppMessage over a pasted campaign. */
    const GYM_NORMALIZED_MESSAGE = [
      '*PLUSFIT A CORRER!!!*',
      '',
      '- Todos nosotros CARRERAS FIT vamos por los 7 km',
      '- Circuito totalmente renovado.',
      '1. Completar el formulario',
      '',
      'Consultas: escribi "hola" al referente, o al 099 123 456; te contestamos.',
      '',
      'https://encarrera.uy/formulario-inscripcion-la-sierra-trail-grupos',
    ].join('\n');

    it('accepts the resolved phones exactly as the gym backend emits them', async () => {
      const errors = await validationErrorsOf({
        to: GYM_NORMALIZED_PHONES,
        message: 'Hola',
      });

      expect(errors).toHaveLength(0);
    });

    it('accepts a full normalized campaign body', async () => {
      const errors = await validationErrorsOf({
        to: GYM_NORMALIZED_PHONES,
        message: GYM_NORMALIZED_MESSAGE,
      });

      expect(errors).toHaveLength(0);
    });

    it('accepts a 500 recipient batch, the size the CSV flow could never send at once', async () => {
      const to = Array.from(
        { length: 500 },
        (_, i) => `+5989912${String(i).padStart(4, '0')}`,
      );

      const errors = await validationErrorsOf({ to, message: GYM_NORMALIZED_MESSAGE });

      expect(errors).toHaveLength(0);
    });

    /**
     * The gym backend normalizes CR out of the message. Should that ever stop
     * happening the DTO would still accept it, so this documents that the guard
     * lives upstream rather than pretending it lives here.
     */
    it('does not itself reject a body that still carries carriage returns', async () => {
      const errors = await validationErrorsOf({
        to: GYM_NORMALIZED_PHONES,
        message: 'uno\r\ndos',
      });

      expect(errors).toHaveLength(0);
    });
  });
});
