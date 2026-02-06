import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import Link from "next/link";
import { Calendar, ArrowLeft } from "lucide-react";

export default async function FounderPage() {
  const supabase = await createClient();

  // @ts-ignore - Supabase type inference issue with organization_profile table
  const { data: profile } = await supabase
    .from("organization_profile")
    .select("certifications")
    .single();

  const certifications = (profile as { certifications?: Json } | null)?.certifications;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />

      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-8 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to About
            </Link>
          </ScrollReveal>

          {/* Hero blurb */}
          <ScrollReveal delay={0.1}>
            <section className="mb-12 text-center">
              <div className="aspect-square max-w-xs mx-auto mb-6 rounded-2xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                Photo placeholder
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                [Founder / CEO Name]
              </h1>
              <p className="text-xl text-primary-600 dark:text-primary-400 font-medium mb-4">
                Founder & CEO, DanSarp Herbal Centre
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                [Short mission statement: e.g. Dedicated to making natural healing accessible and rooted in evidence and tradition.]
              </p>
            </section>
          </ScrollReveal>

          {/* Credentials */}
          <ScrollReveal delay={0.2}>
            <section className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-gray-900 dark:text-white">
                Credentials
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                [Education, certifications, and professional affiliations. Example: Trained in traditional herbal medicine and modern integrative health; member of relevant professional bodies.]
              </p>
              {certifications && Array.isArray(certifications) && certifications.length > 0 && (
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  {(certifications as string[]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          </ScrollReveal>

          {/* Story */}
          <ScrollReveal delay={0.3}>
            <section className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-gray-900 dark:text-white">
                Our Story
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-400">
                <p className="text-lg">
                  [Paragraph 1: Why the centre was founded, personal connection to herbal medicine, and the vision at the time.]
                </p>
                <p className="text-lg">
                  [Paragraph 2: Philosophy of care, commitment to safety and evidence, and the role of tradition and nature in healing.]
                </p>
                <p className="text-lg">
                  [Paragraph 3: Herbal focus and how DanSarp Herbal Centre aims to support the community and each patient.]
                </p>
              </div>
            </section>
          </ScrollReveal>

          {/* Care approach */}
          <ScrollReveal delay={0.4}>
            <section className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-gray-900 dark:text-white">
                Our Care Approach
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                [What makes treatments unique: personalized plans, safety-first use of herbs, integration with conventional care, and ongoing support. Adjust to match your practice.]
              </p>
            </section>
          </ScrollReveal>

          {/* CTA */}
          <ScrollReveal delay={0.5}>
            <section className="text-center border-t border-gray-200 dark:border-gray-700 pt-12">
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Ready to start your healing journey? Book a consultation with our team.
              </p>
              <Link
                href="/appointments"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <Calendar className="w-5 h-5" />
                Book Appointment
              </Link>
              <p className="mt-4">
                <Link href="/about" className="text-primary-600 dark:text-primary-400 hover:underline">
                  Learn more about DanSarp Herbal Centre
                </Link>
              </p>
            </section>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
