import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("id");
    const slug = searchParams.get("slug");
    const status = searchParams.get("status");
    const includeDrafts = searchParams.get("include_drafts") === "true";

    // @ts-ignore - Supabase type inference issue with blog_posts table
    if (postId) {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*, author:users!blog_posts_author_id_fkey(id, full_name, email)")
        .eq("id", postId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ posts: [data], post: data }, { status: 200 });
    } else if (slug) {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*, author:users!blog_posts_author_id_fkey(id, full_name, email)")
        .eq("slug", slug)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ posts: [data], post: data }, { status: 200 });
    } else {
      // For list, filter by status unless include_drafts is true
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const offset = (page - 1) * limit;

      // @ts-ignore - Supabase type inference issue with blog_posts table
      let query = supabase
        .from("blog_posts")
        .select("*, author:users!blog_posts_author_id_fkey(id, full_name, email)", { count: "exact" });

      if (!includeDrafts) {
        query = query.eq("status", "published");
      } else if (status) {
        query = query.eq("status", status);
      }

      // @ts-ignore - Supabase type inference issue
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        posts: data || [],
        post: null,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }, { status: 200 });
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
    const { title, slug, excerpt, content, featured_image_url, status, published_at } = body;

    if (!title || !slug || !excerpt || !content) {
      return NextResponse.json(
        { error: "Title, slug, excerpt, and content are required" },
        { status: 400 }
      );
    }

    // @ts-ignore - Supabase type inference issue with blog_posts table
    const { data: post, error } = await supabase
      .from("blog_posts")
      // @ts-ignore - Supabase type inference issue
      .insert({
        title,
        slug,
        excerpt,
        content,
        author_id: user.id,
        featured_image_url: featured_image_url || null,
        status: status || "draft",
        published_at: status === "published" ? (published_at || new Date().toISOString()) : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ post }, { status: 201 });
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
    const { id, title, slug, excerpt, content, featured_image_url, status, published_at } = body;

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (featured_image_url !== undefined) updateData.featured_image_url = featured_image_url;
    if (status !== undefined) {
      updateData.status = status;
      // If publishing for the first time, set published_at
      if (status === "published" && !published_at) {
        updateData.published_at = new Date().toISOString();
      } else if (status === "draft") {
        updateData.published_at = null;
      } else if (published_at !== undefined) {
        updateData.published_at = published_at;
      }
    }

    // @ts-ignore - Supabase type inference issue with blog_posts table
    const { data: post, error } = await supabase
      .from("blog_posts")
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .eq("id", id)
      .select("*, author:users!blog_posts_author_id_fkey(id, full_name, email)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ post }, { status: 200 });
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
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    // @ts-ignore - Supabase type inference issue with blog_posts table
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
