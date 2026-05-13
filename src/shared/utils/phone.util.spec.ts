import { describe, it, expect } from 'vitest';
import { PhoneUtil } from './phone.util';

describe('PhoneUtil', () => {
  describe('normalize', () => {
    it('should normalize a valid Uruguayan phone number', () => {
      expect(PhoneUtil.normalize('+598 91 234 567')).toBe('+59891234567');
    });

    it('should throw on invalid phone number', () => {
      expect(() => PhoneUtil.normalize('invalid')).toThrow();
    });
  });

  describe('mask', () => {
    it('should mask a phone number showing only last 4 digits', () => {
      expect(PhoneUtil.mask('+59891234567')).toBe('********4567');
    });

    it('should return the same string if length <= 4', () => {
      expect(PhoneUtil.mask('123')).toBe('123');
    });

    it('should handle empty strings', () => {
      expect(PhoneUtil.mask('')).toBe('');
    });
  });

  describe('isValid', () => {
    it('should return true for a valid Uruguayan phone number with prefix', () => {
      expect(PhoneUtil.isValid('+598 91 234 567')).toBe(true);
    });

    it('should return true for a valid Uruguayan phone number without prefix', () => {
      expect(PhoneUtil.isValid('091 234 567')).toBe(true);
    });

    it('should return false for an invalid string', () => {
      expect(PhoneUtil.isValid('invalid')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(PhoneUtil.isValid('')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(PhoneUtil.isValid(null as any)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(PhoneUtil.isValid(undefined as any)).toBe(false);
    });

    it('should return false for a partial/incomplete number', () => {
      expect(PhoneUtil.isValid('+598 91')).toBe(false);
    });

    it('should return false for special characters only', () => {
      expect(PhoneUtil.isValid('!@#$%')).toBe(false);
    });

    it('should return true for an already normalized E.164 number', () => {
      expect(PhoneUtil.isValid('+59891234567')).toBe(true);
    });

    it('should return false for a number with wrong country code', () => {
      expect(PhoneUtil.isValid('+1 555 123 4567')).toBe(false);
    });
  });
});
