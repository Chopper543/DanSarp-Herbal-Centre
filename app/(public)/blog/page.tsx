import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

export default async function BlogPage() {
  const supabase = await createClient();
  
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Blog & Articles
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Health tips, herbal wisdom, and wellness insights
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts?.map((post, index) => (
              <ScrollReveal key={post.id} delay={index * 0.1}>
                <Link href={`/blog/${post.slug}`}>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    {post.featured_image_url && (
                      <div className="relative h-48">
                        <Image
                          src={post.featured_image_url}
                          alt={post.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                        {post.title}
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {post.excerpt}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
