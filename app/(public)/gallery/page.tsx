import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";

export default async function GalleryPage() {
  const supabase = await createClient();
  
  // @ts-ignore - Supabase type inference issue with gallery_items table
  const { data: galleryItems } = await supabase
    .from("gallery_items")
    .select("*")
    .order("created_at", { ascending: false });

  const typedGalleryItems = (galleryItems as Array<{
    id: string;
    type: "doctor" | "event" | "clinic" | "achievement";
    title: string;
    description: string | null;
    image_urls: string[];
    video_url: string | null;
  }> | null) || [];

  const groupedItems = {
    doctor: typedGalleryItems.filter((item) => item.type === "doctor"),
    event: typedGalleryItems.filter((item) => item.type === "event"),
    clinic: typedGalleryItems.filter((item) => item.type === "clinic"),
    achievement: typedGalleryItems.filter((item) => item.type === "achievement"),
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <h1 className="text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">
              Gallery
            </h1>
          </ScrollReveal>

          {Object.entries(groupedItems).map(([type, items]) => {
            if (items.length === 0) return null;
            
            return (
              <ScrollReveal key={type} delay={0.2}>
                <section className="mb-16">
                  <h2 className="text-3xl font-semibold mb-8 text-gray-900 dark:text-white capitalize">
                    {type} Gallery
                  </h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        {item.image_urls && item.image_urls.length > 0 && (
                          <div className="relative h-64">
                            <Image
                              src={item.image_urls[0]}
                              alt={item.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </div>
  );
}
