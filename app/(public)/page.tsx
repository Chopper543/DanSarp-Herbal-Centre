import { Navbar } from "@/components/features/Navbar";
import { HeroSection } from "@/components/features/HeroSection";
import { Footer } from "@/components/features/Footer";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, Users, Award, Heart } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  
  // Fetch top 4 active treatments
  // @ts-ignore - Supabase type inference issue with treatments table
  const { data: treatments } = await supabase
    .from("treatments")
    .select("*")
    .eq("is_active", true)
    .limit(4)
    .order("name", { ascending: true });
  
  const typedTreatments = (treatments as Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
  }> | null) || [];
  return (
    <div className="min-h-screen">
      <Navbar />
      
      <HeroSection />

      {/* Why Choose Us Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">
              Why Choose Us
            </h2>
          </ScrollReveal>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Certified Professionals",
                description: "Our team consists of certified herbal practitioners with years of experience.",
                icon: "✓",
              },
              {
                title: "Natural Healing",
                description: "We use only natural, organic herbs and traditional healing methods.",
                icon: "🌿",
              },
              {
                title: "Proven Results",
                description: "Thousands of patients have found relief and healing through our treatments.",
                icon: "💚",
              },
            ].map((feature, index) => (
              <ScrollReveal key={index} delay={index * 0.2}>
                <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-2xl hover:shadow-lg transition-shadow">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Services/Treatments Preview Section */}
      {typedTreatments.length > 0 && (
        <section className="py-20 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
                Our Services
              </h2>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
                Explore our comprehensive range of herbal treatments designed to support your health and wellness journey.
              </p>
            </ScrollReveal>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {typedTreatments.map((treatment, index) => (
                <ScrollReveal key={treatment.id} delay={index * 0.1}>
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md hover:shadow-xl transition-shadow border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                      {treatment.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm line-clamp-3">
                      {treatment.description}
                    </p>
                    <Link 
                      href={`/treatments#${treatment.slug}`}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium text-sm inline-flex items-center gap-1"
                    >
                      Learn More →
                    </Link>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            
            <div className="text-center mt-8">
              <Link href="/treatments">
                <button className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">
                  View All Services →
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Statistics Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                {
                  icon: Users,
                  number: "10,000+",
                  label: "Patients Served",
                },
                {
                  icon: Award,
                  number: "15+",
                  label: "Years of Experience",
                },
                {
                  icon: Heart,
                  number: "95%",
                  label: "Success Rate",
                },
                {
                  icon: Calendar,
                  number: "5",
                  label: "Treatment Programs",
                },
              ].map((stat, index) => (
                <ScrollReveal key={index} delay={index * 0.1}>
                  <div className="text-center">
                    <stat.icon className="w-12 h-12 mx-auto mb-4 text-primary-200" />
                    <div className="text-4xl md:text-5xl font-bold mb-2">
                      {stat.number}
                    </div>
                    <div className="text-primary-100 text-sm md:text-base">
                      {stat.label}
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              How It Works
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
              Getting started with your healing journey is simple and straightforward.
            </p>
          </ScrollReveal>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Book Consultation",
                description: "Schedule your appointment online or visit our clinic.",
                icon: "📅",
              },
              {
                step: "02",
                title: "Initial Assessment",
                description: "Our experts evaluate your condition and health history.",
                icon: "🔍",
              },
              {
                step: "03",
                title: "Personalized Treatment",
                description: "Receive a customized herbal treatment plan tailored to you.",
                icon: "🌿",
              },
              {
                step: "04",
                title: "Follow-up Care",
                description: "Regular monitoring and adjustments for optimal results.",
                icon: "💚",
              },
            ].map((item, index) => (
              <ScrollReveal key={index} delay={index * 0.15}>
                <div className="text-center">
                  <div className="text-5xl mb-4">{item.icon}</div>
                  <div className="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                    STEP {item.step}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {item.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-4xl font-bold mb-6">
              Ready to Begin Your Healing Journey?
            </h2>
            <p className="text-xl mb-8 text-primary-100">
              Book your consultation today and take the first step towards natural wellness.
            </p>
            <Link href="/appointments">
              <button className="bg-white text-primary-600 hover:bg-primary-50 px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl transform hover:scale-105">
                Book Your Appointment
              </button>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
