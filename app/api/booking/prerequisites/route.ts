import { NextResponse } from "next/server";
import { evaluateBookingPrerequisites } from "@/lib/appointments/prerequisites";

export async function GET() {
  try {
    const result = await evaluateBookingPrerequisites();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

