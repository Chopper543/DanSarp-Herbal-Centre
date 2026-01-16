"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Handle form submission
    setTimeout(() => {
      alert("Thank you for your message! We'll get back to you soon.");
      setFormData({ name: "", email: "", message: "" });
      setSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Contact Us
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Get in touch with us
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8">
            <ScrollReveal>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Contact Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Address</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Oframase New Road, Nkawkaw
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Phone</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      +233 24 690 6739
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Email</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      info@dansarpherbal.com
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Message
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </div>
  );
}
