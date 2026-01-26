import { NextResponse } from "next/server";

export type CacheStrategy = "no-store" | "revalidate" | "static" | "dynamic";

export interface CacheOptions {
  strategy: CacheStrategy;
  maxAge?: number; // in seconds
  revalidate?: number; // in seconds (for ISR)
  staleWhileRevalidate?: number; // in seconds
}

/**
 * Gets cache headers based on strategy
 */
export function getCacheHeaders(options: CacheOptions): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (options.strategy) {
    case "no-store":
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
      headers["Pragma"] = "no-cache";
      headers["Expires"] = "0";
      break;

    case "revalidate":
      if (options.revalidate) {
        headers["Cache-Control"] = `public, s-maxage=${options.revalidate}, stale-while-revalidate=${options.staleWhileRevalidate || options.revalidate}`;
      } else {
        headers["Cache-Control"] = "public, must-revalidate";
      }
      break;

    case "static":
      const maxAge = options.maxAge || 3600; // Default 1 hour
      headers["Cache-Control"] = `public, max-age=${maxAge}, immutable`;
      break;

    case "dynamic":
      headers["Cache-Control"] = "private, no-cache, no-store, must-revalidate";
      headers["Pragma"] = "no-cache";
      headers["Expires"] = "0";
      break;
  }

  return headers;
}

/**
 * Adds cache headers to a NextResponse
 */
export function addCacheHeaders(
  response: NextResponse,
  options: CacheOptions
): NextResponse {
  const headers = getCacheHeaders(options);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Common cache strategies
 */
export const cacheStrategies = {
  // No caching - for user-specific or sensitive data
  noCache: { strategy: "no-store" as const },

  // Short cache - for frequently updated content
  shortCache: { strategy: "static" as const, maxAge: 300 }, // 5 minutes

  // Medium cache - for moderately updated content
  mediumCache: { strategy: "static" as const, maxAge: 3600 }, // 1 hour

  // Long cache - for rarely updated content
  longCache: { strategy: "static" as const, maxAge: 86400 }, // 24 hours

  // ISR - for content that can be regenerated
  isr: { strategy: "revalidate" as const, revalidate: 3600 }, // 1 hour

  // Dynamic - for user-specific content
  dynamic: { strategy: "dynamic" as const },
};
