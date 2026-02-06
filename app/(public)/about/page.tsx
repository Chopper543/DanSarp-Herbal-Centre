import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import Link from "next/link";

export default async function AboutPage() {
  const supabase = await createClient();
  
  // @ts-ignore - Supabase type inference issue with organization_profile table
  const { data: profile } = await supabase
    .from("organization_profile")
    .select("*")
    .single();
  
  const typedProfile = profile as {
    mission: string;
    vision: string;
    values: string;
    team_members?: Json;
    certifications?: Json;
  } | null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h1 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">
              About Us
            </h1>
          </ScrollReveal>

          {typedProfile && (
            <>
              <ScrollReveal delay={0.2}>
                <section className="mb-12">
                  <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Our Mission
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    {typedProfile.mission}
                  </p>
                </section>
              </ScrollReveal>

              <ScrollReveal delay={0.4}>
                <section className="mb-12">
                  <h2 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Our Vision
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    {typedProfile.vision}
                  </p>
                </section>
              </ScrollReveal>

              <ScrollReveal delay={0.6}>
                <section className="mb-12">
                  <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Our Values
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    {typedProfile.values}
                  </p>
                </section>
              </ScrollReveal>
            </>
          )}

          <ScrollReveal delay={0.8}>
            <section className="mt-16 pt-12 border-t border-gray-200 dark:border-gray-700 text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Meet Our Founder
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
                Learn about the vision and experience behind DanSarp Herbal Centre.
              </p>
              <Link
                href="/about/founder"
                className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                About the Founder & CEO
              </Link>
            </section>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
