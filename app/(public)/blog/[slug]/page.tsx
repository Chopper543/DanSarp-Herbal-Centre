import { Navbar } from "@/components/features/Navbar";
import { Footer } from "@/components/features/Footer";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { sanitizeBlogContent } from "@/lib/utils/sanitize";
import { generateMetadata as generateSeoMetadata } from "@/lib/seo/metadata";
import { generateArticleStructuredData } from "@/lib/seo/structured-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  // @ts-ignore - Supabase type inference issue
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) {
    return {};
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dansarpherbal.com";
  const imageUrl = (post as any).featured_image_url || `${siteUrl}/og-image.jpg`;

  return generateSeoMetadata({
    title: `${(post as any).title} | DanSarp Herbal Centre`,
    description: (post as any).excerpt || (post as any).title,
    image: imageUrl,
    url: `${siteUrl}/blog/${slug}`,
    type: "article",
    publishedTime: (post as any).published_at,
    modifiedTime: (post as any).updated_at,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch the blog post by slug
  // @ts-ignore - Supabase type inference issue with blog_posts table
  const { data: post, error: postError } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (postError || !post) {
    notFound();
  }

  // Fetch author information separately
  // @ts-ignore - Supabase type inference issue with users table
  const { data: author } = await supabase
    .from("users")
    .select("id, full_name, email")
    // @ts-ignore - Supabase type inference issue
    .eq("id", (post as any).author_id)
    .single();

  const typedPost = {
    ...(post as any),
    author: author || null,
  } as {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    author_id: string;
    featured_image_url: string | null;
    status: string;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    author: {
      id: string;
      full_name: string | null;
      email: string;
    } | null;
  };

  // Convert markdown-style content to HTML
  const convertContentToHTML = (content: string): string => {
    return content
      .split("\n")
      .map((line) => {
        let html = line.trim();

        // Skip empty lines
        if (!html) return "";

        // Convert headers (lines starting with ** and ending with **)
        if (html.startsWith("**") && html.endsWith("**") && html.length > 4) {
          const text = html.replace(/\*\*/g, "");
          return `<h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">${text}</h2>`;
        }

        // Convert **bold** text
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        // Convert *italic* text
        html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

        // Regular paragraphs
        return `<p class="mb-4">${html}</p>`;
      })
      .filter((p) => p)
      .join("");
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dansarpherbal.com";
  const structuredData = generateArticleStructuredData({
    headline: typedPost.title,
    description: typedPost.excerpt,
    image: typedPost.featured_image_url || undefined,
    datePublished: typedPost.published_at || typedPost.created_at,
    dateModified: typedPost.updated_at,
    author: {
      name: typedPost.author?.full_name || typedPost.author?.email || "DanSarp Herbal Centre",
    },
    publisher: {
      name: "DanSarp Herbal Centre",
      logo: `${siteUrl}/logo.png`,
    },
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <Navbar />

      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Link
            href="/blog"
            className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>

          {/* Featured Image */}
          {typedPost.featured_image_url && (
            <div className="relative h-64 md:h-96 mb-8 rounded-lg overflow-hidden">
              <Image
                src={typedPost.featured_image_url}
                alt={typedPost.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Article Header */}
          <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              {typedPost.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
              {typedPost.published_at && (
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {new Date(typedPost.published_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}
              {typedPost.author && (
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  {typedPost.author.full_name || typedPost.author.email}
                </div>
              )}
            </div>

            {/* Excerpt */}
            <p className="text-xl text-gray-600 dark:text-gray-400 italic border-l-4 border-primary-600 dark:border-primary-400 pl-4">
              {typedPost.excerpt}
            </p>
          </header>

          {/* Article Content */}
          <article className="prose prose-base sm:prose-lg dark:prose-invert max-w-none">
            <div
              className="blog-content text-gray-700 dark:text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: sanitizeBlogContent(convertContentToHTML(typedPost.content)),
              }}
            />
          </article>

          {/* Back to Blog Link */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/blog"
              className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              View All Articles
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
