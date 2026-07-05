import { NextResponse } from "next/server";
import { evaluateBookingPrerequisites } from "@/lib/appointments/prerequisites";
import { internalError } from "@/lib/api/errors";

export async function GET() {
  try {
    const result = await evaluateBookingPrerequisites();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return internalError("/api/booking/prerequisites", error);
  }
}

