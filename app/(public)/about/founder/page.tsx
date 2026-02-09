import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import Link from "next/link";
import { Calendar, ArrowLeft } from "lucide-react";

type TeamMember = {
  name?: string;
  role?: string;
  bio?: string;
  image_url?: string;
};

function parseTeamMembers(input: Json | null | undefined): TeamMember[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is TeamMember => typeof item === "object" && item !== null);
}

function parseCertifications(input: Json | null | undefined): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && "name" in item) {
        const name = (item as any).name;
        const issuer = (item as any).issuer;
        if (typeof name === "string" && typeof issuer === "string") {
          return `${name} (${issuer})`;
        }
        if (typeof name === "string") return name;
      }
      return null;
    })
    .filter((v): v is string => Boolean(v));
}

export default async function FounderPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("organization_profile")
    .select("mission, vision, values, team_members, certifications")
    .single();

  const typedProfile = (profile as {
    mission?: string | null;
    vision?: string | null;
    values?: string | null;
    team_members?: Json | null;
    certifications?: Json | null;
  } | null) ?? {
    mission: null,
    vision: null,
    values: null,
    team_members: null,
    certifications: null,
  };

  const teamMembers = parseTeamMembers(typedProfile.team_members);
  const founder =
    teamMembers.find((member) =>
      /founder|ceo|chief|director/i.test(`${member.role ?? ""} ${member.name ?? ""}`)
    ) || teamMembers[0];

  const founderName = founder?.name || "DanSarp Herbal Centre Leadership";
  const founderRole = founder?.role || "Founder & Clinical Director";
  const founderBio =
    founder?.bio ||
    "DanSarp Herbal Centre was founded to provide safe, patient-centered herbal care that combines trusted traditional practice with disciplined clinical follow-up.";

  const certifications = parseCertifications(typedProfile.certifications);
  const mission =
    typedProfile.mission?.trim() ||
    "To restore health naturally through ethical, evidence-informed herbal care and compassionate patient support.";
  const vision =
    typedProfile.vision?.trim() ||
    "To be the most trusted natural health partner in our communities, known for safety, dignity, and measurable outcomes.";
  const values =
    typedProfile.values?.trim() ||
    "Safety first, personalized care, clinical integrity, and continuous support for every patient journey.";

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
              <div className="aspect-square max-w-xs mx-auto mb-6 rounded-2xl bg-primary-50 dark:bg-gray-700 flex items-center justify-center text-primary-700 dark:text-primary-200 text-sm font-semibold px-4">
                DanSarp Herbal Centre
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {founderName}
              </h1>
              <p className="text-xl text-primary-600 dark:text-primary-400 font-medium mb-4">
                {founderRole}, DanSarp Herbal Centre
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                {mission}
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
                Our leadership team is committed to regulated practice, clear clinical documentation,
                and ongoing professional development in integrative and herbal health care.
              </p>
              {certifications && Array.isArray(certifications) && certifications.length > 0 && (
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  {certifications.map((item, i) => (
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
                  DanSarp Herbal Centre began with a clear purpose: to make dependable herbal care
                  accessible to families who want natural treatment options without compromising on
                  safety or clinical discipline.
                </p>
                <p className="text-lg">
                  {founderBio}
                </p>
                <p className="text-lg">
                  Today, we serve patients through structured consultations, tailored treatment
                  plans, follow-up monitoring, and practical lifestyle guidance rooted in our values.
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
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                We combine personalized herbal prescriptions, careful risk review, and continuous
                patient communication so treatment remains safe, practical, and measurable over time.
              </p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                <span className="font-semibold">Core values:</span> {values}
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
