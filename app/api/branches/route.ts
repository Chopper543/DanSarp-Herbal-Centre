import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("id");

    if (branchId) {
      // @ts-ignore - Supabase type inference issue
      const { data: branch, error } = await supabase
        .from("branches")
        .select("*")
        .eq("id", branchId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ branch }, { status: 200 });
    }

    // Get all branches
    // @ts-ignore - Supabase type inference issue
    const { data: branches, error } = await supabase
      .from("branches")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ branches }, { status: 200 });
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

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, phone, email, latitude, longitude, working_hours, is_active, image_urls } = body;

    // Validate required fields
    if (!name || !address || !phone || !email || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, address, phone, email, latitude, longitude" },
        { status: 400 }
      );
    }

    // Create POINT from latitude and longitude
    // PostgreSQL POINT format: POINT(longitude latitude)
    const coordinates = `POINT(${longitude} ${latitude})`;

    // @ts-ignore - Supabase type inference issue with branches table
    const { data: branch, error } = await supabase
      .from("branches")
      // @ts-ignore - Supabase type inference issue
      .insert({
        name,
        address,
        phone,
        email,
        coordinates,
        working_hours: working_hours || {
          monday: { open: "08:00", close: "17:00" },
          tuesday: { open: "08:00", close: "17:00" },
          wednesday: { open: "08:00", close: "17:00" },
          thursday: { open: "08:00", close: "17:00" },
          friday: { open: "08:00", close: "17:00" },
          saturday: { open: "09:00", close: "14:00" },
          sunday: { closed: true },
        },
        is_active: is_active !== undefined ? is_active : true,
        image_urls: image_urls || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ branch }, { status: 201 });
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
    const isUserAdmin = userRole && isAdmin(userRole);

    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, address, phone, email, latitude, longitude, working_hours, is_active, image_urls } = body;

    if (!id) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (working_hours !== undefined) updateData.working_hours = working_hours;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (image_urls !== undefined) updateData.image_urls = image_urls;

    // Update coordinates if provided
    if (latitude !== undefined && longitude !== undefined) {
      updateData.coordinates = `POINT(${longitude} ${latitude})`;
    }

    // @ts-ignore - Supabase type inference issue with branches table
    const { data: branch, error } = await supabase
      .from("branches")
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ branch }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("id");

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    // @ts-ignore - Supabase type inference issue
    const { error } = await supabase.from("branches").delete().eq("id", branchId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Branch deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
