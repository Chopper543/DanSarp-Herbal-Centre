/**
 * Utility function to add cache-busting to avatar URLs
 * This ensures the browser fetches a fresh image when the avatar is updated
 * 
 * @param avatarUrl - The base avatar URL from Supabase Storage
 * @returns The URL with a timestamp query parameter, or null if no URL provided
 */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  
  // If URL already has query params, append with &, otherwise use ?
  const separator = avatarUrl.includes('?') ? '&' : '?';
  return `${avatarUrl}${separator}t=${Date.now()}`;
}

/**
 * Get avatar URL without cache-busting (for storage in database)
 * Removes any existing cache-busting parameters
 * 
 * @param avatarUrl - The avatar URL (may include cache-busting params)
 * @returns The base URL without cache-busting parameters
 */
export function getBaseAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  
  // Remove cache-busting query parameters
  try {
    const url = new URL(avatarUrl);
    url.searchParams.delete('t');
    return url.toString();
  } catch {
    // If URL parsing fails, try simple string manipulation
    return avatarUrl.split('?')[0].split('&')[0];
  }
}
