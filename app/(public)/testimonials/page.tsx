import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import dynamic from "next/dynamic";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

export default async function TestimonialsPage() {
  const supabase = await createClient();
  
  const { data: testimonials } = await supabase
    .from("testimonials")
    .select("*")
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Patient Testimonials
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Real stories from our patients
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials?.map((testimonial, index) => (
              <ScrollReveal key={testimonial.id} delay={index * 0.1}>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hover:shadow-lg transition-shadow">
                  {testimonial.media_type === "image" && (
                    <div className="relative h-48 mb-4 rounded-lg overflow-hidden">
                      <Image
                        src={testimonial.media_url}
                        alt={testimonial.patient_name || "Testimonial"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  
                  {testimonial.media_type === "video" && (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <ReactPlayer
                        url={testimonial.media_url}
                        width="100%"
                        height="200px"
                        controls
                      />
                    </div>
                  )}
                  
                  {testimonial.media_type === "audio" && (
                    <div className="mb-4">
                      <audio controls className="w-full">
                        <source src={testimonial.media_url} />
                      </audio>
                    </div>
                  )}

                  <p className="text-gray-700 dark:text-gray-300 mb-4 italic">
                    "{testimonial.content}"
                  </p>
                  
                  {testimonial.patient_name && (
                    <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                      — {testimonial.patient_name}
                    </p>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
