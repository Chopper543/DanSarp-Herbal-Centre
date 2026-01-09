import { Navbar } from "@/components/features/Navbar";
import { HeroSection } from "@/components/features/HeroSection";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import Link from "next/link";

export default function HomePage() {
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
    </div>
  );
}
