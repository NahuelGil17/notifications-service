import { describe, it, expect } from 'vitest';
import { PhoneUtil } from './phone.util';

describe('PhoneUtil', () => {
  describe('normalize', () => {
    it('should normalize a valid Argentine phone number', () => {
      expect(PhoneUtil.normalize('+54 9 11 1234-5678')).toBe('+5491112345678');
    });

    it('should throw on invalid phone number', () => {
      expect(() => PhoneUtil.normalize('invalid')).toThrow();
    });
  });

  describe('mask', () => {
    it('should mask a phone number showing only last 4 digits', () => {
      expect(PhoneUtil.mask('+5491112345678')).toBe('**********5678');
    });

    it('should return the same string if length <= 4', () => {
      expect(PhoneUtil.mask('123')).toBe('123');
    });

    it('should handle empty strings', () => {
      expect(PhoneUtil.mask('')).toBe('');
    });
  });
});
