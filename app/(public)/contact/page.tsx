"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { GoogleMap } from "@/components/features/GoogleMap";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Default coordinates for Nkawkaw branch (main clinic)
  const defaultCoordinates = { lat: 6.5500, lng: -0.7667 };
  const defaultAddress = "Oframase New Road, Nkawkaw";
  
  // Initialize with default coordinates, will be updated if branch data is found
  const [mapCoordinates, setMapCoordinates] = useState<{
    lat: number;
    lng: number;
  }>(defaultCoordinates);

  // Fetch main branch coordinates from database
  useEffect(() => {
    async function fetchMainBranch() {
      try {
        const response = await fetch("/api/branches");
        if (response.ok) {
          const data = await response.json();
          const branches = data.branches || [];
          
          // Find Nkawkaw branch (main clinic) or use first active branch
          const mainBranch = branches.find(
            (b: any) => b.name?.toLowerCase().includes("nkawkaw")
          ) || branches[0];

          if (mainBranch?.coordinates) {
            let coords: { lat: number; lng: number } | null = null;
            
            // Handle different coordinate formats
            if (typeof mainBranch.coordinates === 'object') {
              if ('x' in mainBranch.coordinates && 'y' in mainBranch.coordinates) {
                // PostgreSQL POINT format: {x: lng, y: lat}
                coords = {
                  lat: mainBranch.coordinates.y,
                  lng: mainBranch.coordinates.x,
                };
              } else if ('lat' in mainBranch.coordinates && 'lng' in mainBranch.coordinates) {
                coords = mainBranch.coordinates;
              }
            }

            if (coords) {
              setMapCoordinates(coords);
            } else {
              setMapCoordinates(defaultCoordinates);
            }
          } else {
            setMapCoordinates(defaultCoordinates);
          }
        } else {
          setMapCoordinates(defaultCoordinates);
        }
      } catch (error) {
        console.error("Failed to fetch branch coordinates:", error);
        setMapCoordinates(defaultCoordinates);
      }
    }

    fetchMainBranch();
  }, []);

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
            <h1 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Contact Us
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              Get in touch with us
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            <ScrollReveal>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Contact Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Address</h3>
                    <p className="break-words text-gray-600 dark:text-gray-400">
                      Oframase New Road, Nkawkaw
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Phone</h3>
                    <p className="break-words text-gray-600 dark:text-gray-400">
                      +233 24 690 6739
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Email</h3>
                    <p className="break-words text-gray-600 dark:text-gray-400">
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
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

          {/* Google Maps Section */}
          <ScrollReveal delay={0.4}>
            <div className="mt-12">
              <h2 className="text-2xl font-semibold mb-6 text-center text-gray-900 dark:text-white">
                Find Us
              </h2>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                <GoogleMap
                  latitude={mapCoordinates.lat}
                  longitude={mapCoordinates.lng}
                  address={defaultAddress}
                  height="450px"
                  zoom={16}
                  className="w-full"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
