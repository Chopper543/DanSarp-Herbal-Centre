import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Redis } from "@upstash/redis";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database: "healthy" | "unhealthy";
    redis?: "healthy" | "unhealthy" | "not_configured";
  };
  metrics?: {
    memoryUsage?: NodeJS.MemoryUsage;
    responseTime?: number;
  };
  error?: string;
}

export async function GET() {
  const startTime = Date.now();
  const health: HealthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    checks: {
      database: "unhealthy",
    },
  };

  // Check database connection
  try {
    const supabase = await createClient();
    const dbStartTime = Date.now();
    const { error } = await supabase.from("users").select("id").limit(1);
    const dbResponseTime = Date.now() - dbStartTime;

    if (error) {
      health.status = "degraded";
      health.checks.database = "unhealthy";
      health.error = `Database error: ${error.message}`;
    } else {
      health.checks.database = "healthy";
    }
  } catch (error: any) {
    health.status = "unhealthy";
    health.checks.database = "unhealthy";
    health.error = `Database connection failed: ${error.message}`;
  }

  // Check Redis connection (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.ping();
      health.checks.redis = "healthy";
    } catch (error: any) {
      health.status = health.status === "healthy" ? "degraded" : health.status;
      health.checks.redis = "unhealthy";
      if (!health.error) {
        health.error = `Redis error: ${error.message}`;
      }
    }
  } else {
    health.checks.redis = "not_configured";
  }

  // Add metrics in production
  if (process.env.NODE_ENV === "production") {
    const responseTime = Date.now() - startTime;
    health.metrics = {
      memoryUsage: process.memoryUsage(),
      responseTime,
    };
  }

  // Determine final status
  if (health.checks.database === "unhealthy") {
    health.status = "unhealthy";
  } else if (health.checks.redis === "unhealthy") {
    health.status = "degraded";
  }

  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
