import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

export default async function BranchesPage() {
  const supabase = await createClient();
  
  // @ts-ignore - Supabase type inference issue with branches table
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  
  const typedBranches = (branches as Array<{
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    coordinates: { lat: number; lng: number } | { x: number; y: number } | string | null;
    working_hours: Record<string, any> | null;
    image_urls: string[] | null;
  }> | null) || [];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Our Branches
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Visit us at any of our locations
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {typedBranches.map((branch, index) => {
              // Handle coordinates - PostgreSQL POINT can be returned as {x, y} or {lat, lng}
              let coordinates: { lat: number; lng: number } | null = null;
              if (branch.coordinates) {
                if (typeof branch.coordinates === 'object' && 'x' in branch.coordinates && 'y' in branch.coordinates) {
                  // PostgreSQL POINT format: {x: lng, y: lat}
                  coordinates = { lat: (branch.coordinates as { x: number; y: number }).y, lng: (branch.coordinates as { x: number; y: number }).x };
                } else if (typeof branch.coordinates === 'object' && 'lat' in branch.coordinates && 'lng' in branch.coordinates) {
                  coordinates = branch.coordinates as { lat: number; lng: number };
                }
              }
              const workingHours = branch.working_hours as Record<string, any> | null;
              
              const imageUrls = (branch.image_urls as string[] | null) || [];
              
              return (
                <ScrollReveal key={branch.id} delay={index * 0.1}>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Branch Images Gallery */}
                    {imageUrls.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1 h-48">
                        {imageUrls.slice(0, 2).map((imageUrl, imgIndex) => (
                          <div key={imgIndex} className="relative min-h-0 overflow-hidden">
                            <Image
                              src={imageUrl}
                              alt={`${branch.name} - Photo ${imgIndex + 1}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 50vw, 33vw"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Photos coming soon</p>
                      </div>
                    )}
                    
                    <div className="p-6">
                      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                        {branch.name}
                      </h2>
                      
                      <div className="space-y-3 mb-6">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</p>
                          <p className="break-words text-gray-600 dark:text-gray-400">{branch.address}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</p>
                          <p className="break-words text-gray-600 dark:text-gray-400">{branch.phone}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                          <p className="break-words text-gray-600 dark:text-gray-400">{branch.email}</p>
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
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Working Hours
                          </p>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {Object.entries(workingHours).map(([day, hours]: [string, any]) => (
                              <div key={day} className="flex flex-col sm:flex-row sm:justify-between gap-1">
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
