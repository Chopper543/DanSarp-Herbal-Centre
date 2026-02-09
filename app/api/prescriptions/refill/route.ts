import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const refillId = searchParams.get("id");
    const prescriptionId = searchParams.get("prescription_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const canAccessPrescriptions = canAccessSection(userRole, "prescriptions");

    let query = supabase.from("prescription_refills").select("*", { count: "exact" });

    // If requesting specific refill
    if (refillId) {
      // @ts-ignore
      const { data: refill, error } = await supabase
        .from("prescription_refills")
        .select("*")
        .eq("id", refillId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Check permissions
      const typedRefill = refill as { patient_id: string } | null;
      if (!canAccessPrescriptions && typedRefill?.patient_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ refill }, { status: 200 });
    }

    // Filter by prescription_id if provided
    if (prescriptionId) {
      query = query.eq("prescription_id", prescriptionId);
    }

    // Filter by status
    if (status) {
      query = query.eq("status", status);
    }

    // Regular users can only see their own refill requests
    if (!canAccessPrescriptions) {
      query = query.eq("patient_id", user.id);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("requested_date", { ascending: false });

    // @ts-ignore
    const { data: refills, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        refills: refills || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prescription_id, requested_refills } = body;

    if (!prescription_id) {
      return NextResponse.json({ error: "Prescription ID is required" }, { status: 400 });
    }

    // Verify prescription exists and belongs to user
    // @ts-ignore
    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("id", prescription_id)
      .eq("patient_id", user.id)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    // Check if prescription has refills remaining
    const typedPrescription = prescription as { refills_remaining: number } | null;
    if ((typedPrescription?.refills_remaining || 0) <= 0) {
      return NextResponse.json(
        { error: "No refills remaining for this prescription" },
        { status: 400 }
      );
    }

    // Check if there's already a pending refill request
    // @ts-ignore
    const { data: existingRefill, error: existingError } = await supabase
      .from("prescription_refills")
      .select("*")
      .eq("prescription_id", prescription_id)
      .eq("status", "pending")
      .single();

    if (existingRefill && !existingError) {
      return NextResponse.json(
        { error: "A pending refill request already exists for this prescription" },
        { status: 400 }
      );
    }

    // Create refill request
    const refillData = {
      prescription_id,
      patient_id: user.id,
      requested_refills: requested_refills || 1,
      status: "pending",
    };

    // @ts-ignore
    const { data: refill, error } = await supabase
      .from("prescription_refills")
      // @ts-ignore - Supabase type inference issue
      .insert(refillData as any)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ refill }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const canAccessPrescriptions = canAccessSection(userRole, "prescriptions");

    // Only clinical staff/admins with prescriptions section access can approve/reject refill requests.
    if (!canAccessPrescriptions) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, admin_notes } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "Refill ID and status are required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "fulfilled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Get existing refill request
    // @ts-ignore
    const { data: existingRefill, error: fetchError } = await supabase
      .from("prescription_refills")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRefill) {
      return NextResponse.json({ error: "Refill request not found" }, { status: 404 });
    }

    const typedExistingRefill = existingRefill as {
      prescription_id: string;
      requested_refills: number | null;
    } | null;

    // Update refill request
    const updateData: any = {
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (admin_notes) {
      updateData.admin_notes = admin_notes;
    }

    // @ts-ignore
    const { data: refill, error } = await supabase
      .from("prescription_refills")
      // @ts-ignore - Supabase type inference issue
      .update(updateData as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // If approved, update prescription refills_remaining
    if (status === "approved") {
      // @ts-ignore
      const { data: prescription, error: prescriptionError } = await supabase
        .from("prescriptions")
        .select("refills_remaining")
        .eq("id", typedExistingRefill?.prescription_id || "")
        .single();

      if (!prescriptionError && prescription) {
        const typedPrescription = prescription as { refills_remaining: number } | null;
        const newRefillsRemaining = Math.max(
          0,
          (typedPrescription?.refills_remaining || 0) - (typedExistingRefill?.requested_refills || 1)
        );

        // @ts-ignore
        await supabase
          .from("prescriptions")
          // @ts-ignore - Supabase type inference issue
          .update({ refills_remaining: newRefillsRemaining } as any)
          .eq("id", typedExistingRefill?.prescription_id || "");
      }
    }

    return NextResponse.json({ refill }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
