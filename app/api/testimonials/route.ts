import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const testimonialId = searchParams.get("id");
    const approvedOnly = searchParams.get("approved") !== "false";

    // @ts-ignore - Supabase type inference issue with testimonials table
    if (testimonialId) {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .eq("id", testimonialId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ testimonials: [data], testimonial: data }, { status: 200 });
    } else {
      // @ts-ignore - Supabase type inference issue
      let query = supabase.from("testimonials").select("*");

      if (approvedOnly) {
        query = query.eq("is_approved", true);
      }

      // @ts-ignore - Supabase type inference issue
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ testimonials: data || [], testimonial: null }, { status: 200 });
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
    const { patient_name, content, media_type, media_url, is_approved } = body;

    if (!content || !media_type || !media_url) {
      return NextResponse.json(
        { error: "Content, media_type, and media_url are required" },
        { status: 400 }
      );
    }

    // @ts-ignore - Supabase type inference issue with testimonials table
    const { data: testimonial, error } = await supabase
      .from("testimonials")
      // @ts-ignore - Supabase type inference issue
      .insert({
        patient_name: patient_name || null,
        content,
        media_type,
        media_url,
        is_approved: is_approved !== undefined ? is_approved : false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ testimonial }, { status: 201 });
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
    const { id, patient_name, content, media_type, media_url, is_approved } = body;

    if (!id) {
      return NextResponse.json({ error: "Testimonial ID is required" }, { status: 400 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (patient_name !== undefined) updateData.patient_name = patient_name;
    if (content !== undefined) updateData.content = content;
    if (media_type !== undefined) updateData.media_type = media_type;
    if (media_url !== undefined) updateData.media_url = media_url;
    if (typeof is_approved === "boolean") updateData.is_approved = is_approved;

    // @ts-ignore - Supabase type inference issue with testimonials table
    const { data: testimonial, error } = await supabase
      .from("testimonials")
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ testimonial }, { status: 200 });
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
      return NextResponse.json({ error: "Testimonial ID is required" }, { status: 400 });
    }

    // @ts-ignore - Supabase type inference issue with testimonials table
    const { error } = await supabase.from("testimonials").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
