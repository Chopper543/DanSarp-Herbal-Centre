import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  };

  try {
    // Check database connection
    const supabase = await createClient();
    const { error } = await supabase.from("users").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          ...health,
          status: "degraded",
          database: "unhealthy",
          error: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ...health,
      database: "healthy",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ...health,
        status: "unhealthy",
        database: "unhealthy",
        error: error.message,
      },
      { status: 503 }
    );
  }
}
