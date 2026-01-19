import { Navbar } from "@/components/features/Navbar";
import { Footer } from "@/components/features/Footer";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, User } from "lucide-react";

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
    .eq("id", post.author_id)
    .single();

  const typedPost = {
    ...post,
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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
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
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
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
          <article className="prose prose-lg dark:prose-invert max-w-none">
            <div
              className="blog-content text-gray-700 dark:text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: convertContentToHTML(typedPost.content),
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
