import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function BranchesPage() {
  const supabase = await createClient();
  
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Our Branches
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Visit us at any of our locations
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {branches?.map((branch, index) => {
              const coordinates = branch.coordinates as { lat: number; lng: number } | null;
              const workingHours = branch.working_hours as Record<string, any> | null;
              
              return (
                <ScrollReveal key={branch.id} delay={index * 0.1}>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                      {branch.name}
                    </h2>
                    
                    <div className="space-y-3 mb-6">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</p>
                        <p className="text-gray-600 dark:text-gray-400">{branch.address}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</p>
                        <p className="text-gray-600 dark:text-gray-400">{branch.phone}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                        <p className="text-gray-600 dark:text-gray-400">{branch.email}</p>
                      </div>

                      {coordinates && (
                        <div>
                          <Link
                            href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            View on Google Maps →
                          </Link>
                        </div>
                      )}
                    </div>

                    {workingHours && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Working Hours
                        </p>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {Object.entries(workingHours).map(([day, hours]: [string, any]) => (
                            <div key={day} className="flex justify-between">
                              <span className="capitalize">{day}</span>
                              <span>
                                {hours.closed ? "Closed" : `${hours.open} - ${hours.close}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
