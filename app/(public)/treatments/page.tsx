import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function TreatmentsPage() {
  const supabase = await createClient();
  
  // @ts-ignore - Supabase type inference issue with treatments table
  const { data: treatments, error } = await supabase
    .from("treatments")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  
  if (error) {
    console.error("Error fetching treatments:", error);
  }
  
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

          {typedTreatments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No treatments available at the moment.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {error ? `Error: ${error.message}` : "Please check back later or contact us for more information."}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {typedTreatments.map((treatment, index) => {
              const pricing = treatment.pricing as any;
              
              // Helper function to format pricing field names
              const formatFieldName = (key: string): string => {
                const nameMap: Record<string, string> = {
                  consultation: "Consultation",
                  monthly_therapy: "Monthly Herbal Therapy",
                  lifestyle_coaching: "Lifestyle Coaching",
                  nutrition_coaching: "Nutrition Coaching",
                  stress_management_coaching: "Stress Management Coaching",
                  wellness_coaching: "Wellness Coaching",
                  counseling: "Counseling",
                  follow_up: "Follow-up",
                  monitoring: "Monitoring"
                };
                return nameMap[key] || key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
              };

              // Helper function to format pricing value
              const formatPricingValue = (key: string, value: any): string => {
                if (key === "monthly_therapy" && typeof value === "object") {
                  return `GHS ${value.min || "N/A"} - ${value.max || "N/A"}`;
                }
                if (typeof value === "number") {
                  // Add "per session" for coaching/counseling fields
                  const sessionFields = ["lifestyle_coaching", "nutrition_coaching", "stress_management_coaching", "wellness_coaching", "counseling"];
                  if (sessionFields.includes(key)) {
                    return `GHS ${value} per session`;
                  }
                  return `GHS ${value}`;
                }
                return "N/A";
              };

              // Get all pricing fields except consultation and monthly_therapy (handled separately)
              const pricingFields = Object.entries(pricing || {}).filter(
                ([key]) => key !== "monthly_therapy" && key !== "consultation"
              );

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
                      {/* Consultation - always show first */}
                      {pricing?.consultation && (
                        <div className="flex justify-between">
                          <span className="text-gray-700 dark:text-gray-300">Consultation:</span>
                          <span className="font-semibold text-primary-600 dark:text-primary-400">
                            GHS {pricing.consultation}
                          </span>
                        </div>
                      )}
                      
                      {/* Monthly Therapy - always show second */}
                      {pricing?.monthly_therapy && (
                        <div className="flex justify-between">
                          <span className="text-gray-700 dark:text-gray-300">Monthly Herbal Therapy:</span>
                          <span className="font-semibold text-primary-600 dark:text-primary-400">
                            {formatPricingValue("monthly_therapy", pricing.monthly_therapy)}
                          </span>
                        </div>
                      )}
                      
                      {/* Other pricing fields */}
                      {pricingFields.map(([key, value]) => {
                        if (!value) return null;
                        return (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-700 dark:text-gray-300">
                              {formatFieldName(key)}:
                            </span>
                            <span className="font-semibold text-primary-600 dark:text-primary-400">
                              {formatPricingValue(key, value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <Link
                      href={`/appointments?treatment=${treatment.slug}`}
                      className="block w-full bg-primary-600 hover:bg-primary-950 text-white text-center py-3 rounded-lg font-semibold transition-colors"
                    >
                      Book Appointment
                    </Link>
                  </div>
                </ScrollReveal>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
