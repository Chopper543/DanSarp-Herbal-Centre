/**
 * Payment validation utilities
 */

/**
 * Ghana mobile NDC prefixes (2026): MTN (024,025,053,054,055,059), Telecel (020,050),
 * AT (027,057,026,056), Glo (023). Validates local (0XXXXXXXXX) and international (+233XXXXXXXXX).
 */
const GHANA_PHONE_REGEX = /^(?:\+233|0)(?:20|50|24|25|53|54|55|59|27|57|26|56|23)\d{7}$/;

/**
 * Validates Ghana phone number format.
 * Accepts local format (0XXXXXXXXX) and international (+233XXXXXXXXX) for all major networks.
 */
export function validateGhanaPhoneNumber(phone: string): boolean {
  if (!phone || phone.trim() === '') {
    return false;
  }
  const cleaned = phone.replace(/\s+/g, '').trim();
  return GHANA_PHONE_REGEX.test(cleaned);
}

/**
 * Formats Ghana phone number for display
 */
export function formatGhanaPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('233')) {
    return cleaned.replace(/^233/, '0');
  }
  return cleaned;
}

/**
 * Validates card number using Luhn algorithm
 */
export function validateCardNumber(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(cleaned)) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Formats card number with spaces (XXXX XXXX XXXX XXXX)
 */
export function formatCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s+/g, '');
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
}

/**
 * Validates expiration date (MM/YY format)
 */
export function validateExpiryDate(expiry: string): boolean {
  const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
  if (!regex.test(expiry)) {
    return false;
  }

  const [month, year] = expiry.split('/');
  const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
  const now = new Date();

  return expiryDate > now;
}

/**
 * Formats expiration date as MM/YY
 */
export function formatExpiryDate(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + (cleaned.length > 2 ? '/' + cleaned.slice(2, 4) : '');
  }
  return cleaned;
}

/**
 * Validates card PIN (4-6 digits)
 */
export function validateCardPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Validates account number (basic validation)
 */
export function validateAccountNumber(accountNumber: string): boolean {
  return /^\d{8,20}$/.test(accountNumber.replace(/\s+/g, ''));
}

/**
 * Gets card type from card number
 */
export function getCardType(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s+/g, '');
  
  if (/^4/.test(cleaned)) {
    return 'Visa';
  }
  if (/^5[1-5]/.test(cleaned)) {
    return 'Mastercard';
  }
  if (/^6/.test(cleaned)) {
    return 'Discover';
  }
  if (/^3[47]/.test(cleaned)) {
    return 'American Express';
  }
  
  return 'Unknown';
}
