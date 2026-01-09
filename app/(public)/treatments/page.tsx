import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function TreatmentsPage() {
  const supabase = await createClient();
  
  // @ts-ignore - Supabase type inference issue with treatments table
  const { data: treatments } = await supabase
    .from("treatments")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  
  const typedTreatments = (treatments as Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    pricing: any;
  }> | null) || [];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Treatment & Pricing Directory
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Comprehensive herbal treatments for various conditions
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {typedTreatments.map((treatment, index) => {
              const pricing = treatment.pricing as any;
              
              return (
                <ScrollReveal key={treatment.id} delay={index * 0.1}>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                      {treatment.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {treatment.description}
                    </p>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Consultation:</span>
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          GHS {pricing?.consultation || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Monthly Therapy:</span>
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          GHS {pricing?.monthly_therapy?.min || "N/A"} - {pricing?.monthly_therapy?.max || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Lifestyle Coaching:</span>
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          GHS {pricing?.lifestyle_coaching || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Follow-up:</span>
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          GHS {pricing?.follow_up || "N/A"}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/appointments?treatment=${treatment.slug}`}
                      className="block w-full bg-primary-600 hover:bg-primary-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
                    >
                      Book Appointment
                    </Link>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
