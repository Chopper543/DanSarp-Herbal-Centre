import { Navbar } from "@/components/features/Navbar";
import { HeroSection } from "@/components/features/HeroSection";
import { Footer } from "@/components/features/Footer";
import { NewsletterSignup } from "@/components/features/NewsletterSignup";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, Users, Award, Heart, Star, Shield, CheckCircle, Mail, ChevronDown } from "lucide-react";
import Image from "next/image";

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
  
  // Fetch top 3 approved testimonials
  // @ts-ignore - Supabase type inference issue with testimonials table
  const { data: testimonials } = await supabase
    .from("testimonials")
    .select("*")
    .eq("is_approved", true)
    .limit(3)
    .order("created_at", { ascending: false });

  // Fetch recent blog posts
  // @ts-ignore - Supabase type inference issue with blog_posts table
  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .limit(3)
    .order("created_at", { ascending: false });
  
  const typedTreatments = (treatments as Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
  }> | null) || [];

  const typedTestimonials = (testimonials as Array<{
    id: string;
    patient_name: string | null;
    content: string;
    media_type: "image" | "audio" | "video";
    media_url: string;
  }> | null) || [];

  const typedBlogPosts = (blogPosts as Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    featured_image: string | null;
    created_at: string;
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

      {/* Trust Badges/Certifications Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                {
                  icon: Shield,
                  title: "Certified",
                  description: "Licensed Practitioners",
                },
                {
                  icon: CheckCircle,
                  title: "Verified",
                  description: "Approved Treatments",
                },
                {
                  icon: Award,
                  title: "Award Winning",
                  description: "Recognition & Excellence",
                },
                {
                  icon: Heart,
                  title: "Trusted",
                  description: "10,000+ Patients",
                },
              ].map((badge, index) => (
                <ScrollReveal key={index} delay={index * 0.1}>
                  <div className="text-center">
                    <badge.icon className="w-12 h-12 mx-auto mb-3 text-primary-600 dark:text-primary-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {badge.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {badge.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Services/Treatments Preview Section */}
      {typedTreatments.length > 0 && (
        <section className="py-20 bg-white dark:bg-gray-900">
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

      {/* Testimonials Preview Section */}
      {typedTestimonials.length > 0 && (
        <section className="py-20 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
                What Our Patients Say
              </h2>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
                Real stories from patients who have experienced healing through our treatments.
              </p>
            </ScrollReveal>
            
            <div className="grid md:grid-cols-3 gap-8">
              {typedTestimonials.map((testimonial, index) => (
                <ScrollReveal key={testimonial.id} delay={index * 0.15}>
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                    <div className="flex mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-5 h-5 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-4 italic line-clamp-4">
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
            
            <div className="text-center mt-8">
              <Link href="/testimonials">
                <button className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">
                  Read More Testimonials →
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

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

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Find answers to common questions about our treatments and services.
            </p>
          </ScrollReveal>
          
          <div className="space-y-4">
            {[
              {
                question: "What conditions do you treat?",
                answer: "We specialize in cancer care support, diabetes management, hypertension, infertility support, and general wellness. Our herbal treatments are designed to complement conventional medical care.",
              },
              {
                question: "How long does a treatment program last?",
                answer: "Treatment duration varies based on individual needs and conditions. Most programs range from 3 to 6 months, with regular follow-up consultations to monitor progress.",
              },
              {
                question: "Are your treatments safe?",
                answer: "Yes, all our herbal treatments are prepared by certified practitioners using natural, organic ingredients. We conduct thorough assessments before prescribing any treatment plan.",
              },
              {
                question: "Do I need a referral from a doctor?",
                answer: "While not required, we recommend consulting with your primary healthcare provider. Our treatments are designed to complement, not replace, conventional medical care.",
              },
              {
                question: "How do I book an appointment?",
                answer: "You can book an appointment online through our website, visit our clinic in person, or call us directly. We offer flexible scheduling to accommodate your needs.",
              },
            ].map((faq, index) => (
              <ScrollReveal key={index} delay={index * 0.1}>
                <details className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
                  <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer flex items-center justify-between">
                    <span>{faq.question}</span>
                    <ChevronDown className="w-5 h-5 text-primary-600 dark:text-primary-400 transition-transform duration-200" />
                  </summary>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">
                    {faq.answer}
                  </p>
                </details>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Posts Preview Section */}
      {typedBlogPosts.length > 0 && (
        <section className="py-20 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h2 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
                Latest from Our Blog
              </h2>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
                Stay informed with health tips, treatment insights, and wellness advice from our experts.
              </p>
            </ScrollReveal>
            
            <div className="grid md:grid-cols-3 gap-8">
              {typedBlogPosts.map((post, index) => (
                <ScrollReveal key={post.id} delay={index * 0.15}>
                  <Link href={`/blog/${post.slug}`}>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow cursor-pointer">
                      {post.featured_image && (
                        <div className="relative h-48 w-full">
                          <Image
                            src={post.featured_image}
                            alt={post.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-6">
                        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium text-sm">
                            Read More →
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
            
            <div className="text-center mt-8">
              <Link href="/blog">
                <button className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">
                  View All Blog Posts →
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Newsletter Signup Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <Mail className="w-16 h-16 mx-auto mb-6 text-primary-200" />
            <h2 className="text-4xl font-bold mb-4">
              Stay Connected
            </h2>
            <p className="text-xl mb-8 text-primary-100">
              Subscribe to our newsletter for health tips, treatment updates, and wellness insights.
            </p>
            <NewsletterSignup />
          </ScrollReveal>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">
              Ready to Begin Your Healing Journey?
            </h2>
            <p className="text-xl mb-8 text-gray-600 dark:text-gray-400">
              Book your consultation today and take the first step towards natural wellness.
            </p>
            <Link href="/appointments">
              <button className="bg-primary-600 hover:bg-primary-950 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl transform hover:scale-105">
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
