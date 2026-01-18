/**
 * Phone format utilities for Supabase integration
 * Supabase requires phone numbers in international format with country code
 */

/**
 * Converts Ghana phone number from local format to international format for Supabase
 * @param phone - Phone number in local format (0244123456) or international format (233244123456)
 * @returns Phone number in international format with + prefix (+233244123456)
 * 
 * Examples:
 * - "0244123456" → "+233244123456"
 * - "233244123456" → "+233244123456"
 * - "+233244123456" → "+233244123456" (already formatted)
 */
export function formatPhoneForSupabase(phone: string): string {
  const cleaned = phone.replace(/\D/g, ''); // Remove all non-digits
  
  // If already has + prefix, remove it first
  const digits = cleaned;
  
  // If starts with 233 (international without +), add +
  if (digits.startsWith('233')) {
    return `+${digits}`;
  }
  
  // If starts with 0 (local format), replace 0 with +233
  if (digits.startsWith('0')) {
    return `+233${digits.slice(1)}`;
  }
  
  // Default: assume it's missing country code, add +233
  return `+233${digits}`;
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
