import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const treatmentId = searchParams.get("id");
    const slug = searchParams.get("slug");
    const includeInactive = searchParams.get("include_inactive") === "true";

    // @ts-ignore - Supabase type inference issue with treatments table
    if (treatmentId) {
      const { data, error } = await supabase
        .from("treatments")
        .select("*")
        .eq("id", treatmentId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ treatments: [data], treatment: data }, { status: 200 });
    } else if (slug) {
      const { data, error } = await supabase
        .from("treatments")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ treatments: [data], treatment: data }, { status: 200 });
    } else {
      // @ts-ignore - Supabase type inference issue
      let query = supabase.from("treatments").select("*");

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      // @ts-ignore - Supabase type inference issue
      const { data, error } = await query.order("name", { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ treatments: data || [], treatment: null }, { status: 200 });
    }
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
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, condition_type, pricing, is_active } = body;

    if (!name || !slug || !description || !condition_type || !pricing) {
      return NextResponse.json(
        { error: "Name, slug, description, condition_type, and pricing are required" },
        { status: 400 }
      );
    }

    // @ts-ignore - Supabase type inference issue with treatments table
    const { data: treatment, error } = await supabase
      .from("treatments")
      // @ts-ignore - Supabase type inference issue
      .insert({
        name,
        slug,
        description,
        condition_type,
        pricing,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ treatment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, slug, description, condition_type, pricing, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "Treatment ID is required" }, { status: 400 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (condition_type !== undefined) updateData.condition_type = condition_type;
    if (pricing !== undefined) updateData.pricing = pricing;
    if (is_active !== undefined) updateData.is_active = is_active;

    // @ts-ignore - Supabase type inference issue with treatments table
    const { data: treatment, error } = await supabase
      .from("treatments")
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ treatment }, { status: 200 });
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
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Treatment ID is required" }, { status: 400 });
    }

    // @ts-ignore - Supabase type inference issue with treatments table
    const { error } = await supabase.from("treatments").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
