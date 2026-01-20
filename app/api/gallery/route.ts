import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("id");
    const type = searchParams.get("type");

    // @ts-ignore - Supabase type inference issue with gallery_items table
    if (itemId) {
      const { data, error } = await supabase
        .from("gallery_items")
        .select("*")
        .eq("id", itemId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ items: [data], item: data }, { status: 200 });
    } else if (type) {
      // @ts-ignore - Supabase type inference issue
      const { data, error } = await supabase
        .from("gallery_items")
        .select("*")
        .eq("type", type)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ items: data || [], item: null }, { status: 200 });
    } else {
      // @ts-ignore - Supabase type inference issue
      const { data, error } = await supabase
        .from("gallery_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ items: data || [], item: null }, { status: 200 });
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
    const { type, title, description, image_urls, video_url, metadata, is_featured } = body;

    if (!type || !title) {
      return NextResponse.json(
        { error: "Type and title are required" },
        { status: 400 }
      );
    }

    // @ts-ignore - Supabase type inference issue with gallery_items table
    const { data: item, error } = await supabase
      .from("gallery_items")
      // @ts-ignore - Supabase type inference issue
      .insert({
        type,
        title,
        description: description || null,
        image_urls: image_urls || [],
        video_url: video_url || null,
        metadata: metadata || {},
        is_featured: is_featured || false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ item }, { status: 201 });
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
    const { id, type, title, description, image_urls, video_url, metadata, is_featured } = body;

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (image_urls !== undefined) updateData.image_urls = image_urls;
    if (video_url !== undefined) updateData.video_url = video_url;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (is_featured !== undefined) updateData.is_featured = is_featured;

    // @ts-ignore - Supabase type inference issue with gallery_items table
    const { data: item, error } = await supabase
      .from("gallery_items")
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ item }, { status: 200 });
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
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    // @ts-ignore - Supabase type inference issue with gallery_items table
    const { error } = await supabase.from("gallery_items").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
