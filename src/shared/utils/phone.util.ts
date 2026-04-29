import { parsePhoneNumberWithError } from 'libphonenumber-js';

export class PhoneUtil {
  /**
   * Normalizes a phone number to E.164 format.
   * Throws if invalid.
   */
  static normalize(phone: string): string {
    try {
      const phoneNumber = parsePhoneNumberWithError(phone, 'AR'); // Default to AR if no prefix
      return phoneNumber.format('E.164');
    } catch (error) {
      throw new Error(`Invalid phone number: ${phone}`);
    }
  }

  /**
   * Masks a phone number showing only the last 4 digits.
   * Example: +5491112345678 -> +***********5678
   */
  static mask(phone: string): string {
    if (!phone) return '';
    const length = phone.length;
    if (length <= 4) return phone;
    return '*'.repeat(length - 4) + phone.slice(-4);
  }
}
