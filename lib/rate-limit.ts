import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client (fallback to in-memory if not configured)
let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;

// Initialize rate limiter with Upstash Redis if available
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 s"), // Default: 10 requests per 10 seconds
    analytics: true,
  });
}

// In-memory fallback rate limiter for development
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const reset = oldestRequest + this.windowMs;
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: Math.ceil(reset / 1000),
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - validRequests.length,
      reset: Math.ceil((now + this.windowMs) / 1000),
    };
  }
}

// Create in-memory rate limiters for different endpoints
const inMemoryLimiters: Map<string, InMemoryRateLimiter> = new Map();

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // Auth endpoints - stricter limits
  "/api/auth": { maxRequests: 5, windowSeconds: 60 },
  "/api/auth/login": { maxRequests: 5, windowSeconds: 60 },
  "/api/auth/signup": { maxRequests: 3, windowSeconds: 60 },
  "/api/auth/2fa": { maxRequests: 10, windowSeconds: 60 },
  
  // Payment endpoints - moderate limits
  "/api/payments": { maxRequests: 10, windowSeconds: 60 },
  "/api/webhooks/payments": { maxRequests: 100, windowSeconds: 60 },
  
  // Newsletter - prevent spam
  "/api/newsletter": { maxRequests: 3, windowSeconds: 60 },
  
  // General API - default limits
  default: { maxRequests: 30, windowSeconds: 60 },
};

export async function checkRateLimit(
  identifier: string,
  path: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  // Use Upstash if available
  if (ratelimit) {
    const config = rateLimitConfigs[path] || rateLimitConfigs.default;
    const customLimiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowSeconds} s`),
      analytics: true,
    });
    return await customLimiter.limit(identifier);
  }

  // Fallback to in-memory rate limiter
  const config = rateLimitConfigs[path] || rateLimitConfigs.default;
  const key = `${path}:${config.maxRequests}:${config.windowSeconds}`;
  
  if (!inMemoryLimiters.has(key)) {
    inMemoryLimiters.set(
      key,
      new InMemoryRateLimiter(config.maxRequests, config.windowSeconds * 1000)
    );
  }

  const limiter = inMemoryLimiters.get(key)!;
  return await limiter.limit(identifier);
}

export function getRateLimitIdentifier(request: Request): string {
  // Try to get IP from headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  
  const ip = forwardedFor?.split(",")[0] || realIp || cfConnectingIp || "unknown";
  return ip.trim();
}
