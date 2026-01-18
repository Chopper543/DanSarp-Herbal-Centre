/**
 * Phone format utilities for Supabase integration
 * Supabase requires phone numbers in international format with country code (E.164 format)
 */

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

  const cleaned = phone.replace(/\D/g, ''); // Remove all non-digits
  
  if (cleaned.length === 0) {
    if (debug) console.warn('formatPhoneForSupabase: No digits found in phone number');
    throw new Error('Phone number must contain digits');
  }

  let result: string;

  // If already has + prefix, validate and return
  if (phone.trim().startsWith('+')) {
    const withPlus = phone.trim();
    if (isValidE164Format(withPlus)) {
      if (debug) console.log('formatPhoneForSupabase: Already in E.164 format', withPlus);
      return withPlus;
    }
    // If + prefix but invalid format, try to fix it
    const digits = cleaned;
    if (digits.startsWith('233')) {
      result = `+${digits}`;
    } else if (digits.startsWith('0')) {
      result = `+233${digits.slice(1)}`;
    } else {
      result = `+233${digits}`;
    }
  }
  // If starts with 233 (international without +), add +
  else if (cleaned.startsWith('233')) {
    result = `+${cleaned}`;
  }
  // If starts with 0 (local format), replace 0 with +233
  else if (cleaned.startsWith('0')) {
    result = `+233${cleaned.slice(1)}`;
  }
  // Default: assume it's missing country code, add +233
  else {
    result = `+233${cleaned}`;
  }

  // Validate the result
  if (!isValidE164Format(result)) {
    if (debug) console.error('formatPhoneForSupabase: Invalid E.164 format result', result);
    throw new Error(`Invalid phone format: ${result}. Expected E.164 format (+233XXXXXXXXX)`);
  }

  if (debug) {
    console.log('formatPhoneForSupabase:', {
      input: phone,
      cleaned,
      output: result,
      isValid: isValidE164Format(result)
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
