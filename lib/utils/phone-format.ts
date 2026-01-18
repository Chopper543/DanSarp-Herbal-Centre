/**
 * Phone format utilities for Supabase integration
 * Supabase requires phone numbers in international format with country code (E.164 format)
 * Twilio requires strict E.164 format with no whitespace or special characters
 */

/**
 * Sanitizes phone number by removing all non-digit characters except +
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone number
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove all characters except digits and +
  return phone.replace(/[^\d+]/g, '').trim();
}

/**
 * Validates if a phone number is in E.164 format
 * @param phone - Phone number to validate
 * @returns true if phone is in valid E.164 format
 */
export function isValidE164Format(phone: string): boolean {
  // E.164 format: +[country code][number], max 15 digits after +
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validates Ghana mobile phone number format specifically for Twilio
 * Ghana mobile numbers: +233 followed by 9 digits (prefix 24, 20, or 27 + 7 digits)
 * @param phone - Phone number in E.164 format
 * @returns true if phone is a valid Ghana mobile number
 */
export function isValidGhanaMobileNumber(phone: string): boolean {
  // Ghana mobile: +233(24|20|27) + 7 digits = 13 total characters
  const ghanaMobileRegex = /^\+233(24|20|27)\d{7}$/;
  return ghanaMobileRegex.test(phone);
}

/**
 * Converts Ghana phone number from local format to international format for Supabase
 * @param phone - Phone number in local format (0244123456) or international format (233244123456 or +233244123456)
 * @param debug - Optional: enable debug logging
 * @returns Phone number in international format with + prefix (+233244123456)
 * 
 * Examples:
 * - "0244123456" → "+233244123456"
 * - "233244123456" → "+233244123456"
 * - "+233244123456" → "+233244123456" (already formatted)
 */
export function formatPhoneForSupabase(phone: string, debug: boolean = false): string {
  if (!phone || phone.trim() === '') {
    if (debug) console.warn('formatPhoneForSupabase: Empty phone number provided');
    throw new Error('Phone number cannot be empty');
  }

  // Sanitize: remove all non-digit characters except +
  const sanitized = sanitizePhoneNumber(phone);
  
  if (sanitized.length === 0) {
    if (debug) console.warn('formatPhoneForSupabase: No digits found in phone number');
    throw new Error('Phone number must contain digits');
  }

  // Extract digits only (for processing)
  const digits = sanitized.replace(/\D/g, '');
  
  if (digits.length === 0) {
    if (debug) console.warn('formatPhoneForSupabase: No digits found after sanitization');
    throw new Error('Phone number must contain digits');
  }

  let result: string;

  // If already has + prefix, validate and return if correct
  if (sanitized.startsWith('+')) {
    // Check if it's already in correct format
    if (isValidGhanaMobileNumber(sanitized)) {
      if (debug) console.log('formatPhoneForSupabase: Already in correct Ghana mobile format', sanitized);
      return sanitized;
    }
    if (isValidE164Format(sanitized)) {
      // Valid E.164 but might not be Ghana mobile - try to fix if it's Ghana
      if (digits.startsWith('233') && digits.length === 12) {
        // Already has country code, just ensure + prefix
        result = `+${digits}`;
      } else {
        if (debug) console.warn('formatPhoneForSupabase: Valid E.164 but not Ghana format', sanitized);
        return sanitized; // Return as-is if valid E.164
      }
    } else {
      // Has + but invalid format, try to fix
      if (digits.startsWith('233')) {
        result = `+${digits}`;
      } else if (digits.startsWith('0')) {
        result = `+233${digits.slice(1)}`;
      } else {
        result = `+233${digits}`;
      }
    }
  }
  // If starts with 233 (international without +), add +
  else if (digits.startsWith('233')) {
    result = `+${digits}`;
  }
  // If starts with 0 (local format), replace 0 with +233
  else if (digits.startsWith('0')) {
    result = `+233${digits.slice(1)}`;
  }
  // Default: assume it's missing country code, add +233
  else {
    result = `+233${digits}`;
  }

  // Ensure result is exactly 13 characters for Ghana mobile (+233 + 9 digits)
  // Validate Ghana mobile format specifically
  if (!isValidGhanaMobileNumber(result)) {
    if (debug) {
      console.error('formatPhoneForSupabase: Invalid Ghana mobile format', {
        result,
        length: result.length,
        expectedLength: 13,
        isValidE164: isValidE164Format(result),
        isValidGhana: isValidGhanaMobileNumber(result)
      });
    }
    throw new Error(`Invalid Ghana mobile phone format: ${result}. Expected format: +233XXXXXXXXX (13 characters total)`);
  }

  // Final validation: ensure E.164 format
  if (!isValidE164Format(result)) {
    if (debug) console.error('formatPhoneForSupabase: Invalid E.164 format result', result);
    throw new Error(`Invalid phone format: ${result}. Expected E.164 format (+233XXXXXXXXX)`);
  }

  if (debug) {
    console.log('formatPhoneForSupabase:', {
      input: phone,
      sanitized,
      digits,
      output: result,
      length: result.length,
      isValidE164: isValidE164Format(result),
      isValidGhana: isValidGhanaMobileNumber(result)
    });
  }

  return result;
}

/**
 * Converts international format back to local format for display
 * @param phone - Phone number in international format (+233244123456)
 * @returns Phone number in local format (0244123456)
 */
export function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('233')) {
    return `0${cleaned.slice(3)}`;
  }
  
  return cleaned;
}
