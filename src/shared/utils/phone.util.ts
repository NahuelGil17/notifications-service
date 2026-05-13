import { parsePhoneNumberWithError, isValidPhoneNumber } from 'libphonenumber-js';

export class PhoneUtil {
  /**
   * Normalizes a phone number to E.164 format.
   * Throws if invalid.
   */
  static normalize(phone: string): string {
    try {
      const phoneNumber = parsePhoneNumberWithError(phone, 'UY'); // Default to UY if no prefix
      return phoneNumber.format('E.164');
    } catch (error) {
      throw new Error(`Invalid phone number: ${phone}`);
    }
  }

  /**
   * Returns true if the phone number is valid for default country UY.
   * Never throws. Returns false for null, undefined, or invalid strings.
   */
  static isValid(phone: string): boolean {
    if (!phone) return false;
    return isValidPhoneNumber(phone, 'UY');
  }

  /**
   * Masks a phone number showing only the last 4 digits.
   * Example: +59891234567 -> ********4567
   */
  static mask(phone: string): string {
    if (!phone) return '';
    const length = phone.length;
    if (length <= 4) return phone;
    return '*'.repeat(length - 4) + phone.slice(-4);
  }
}
