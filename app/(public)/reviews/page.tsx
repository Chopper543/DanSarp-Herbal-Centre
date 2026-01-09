"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/features/Navbar";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { createClient } from "@/lib/supabase/client";
import { Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  is_verified: boolean;
  created_at: string;
  user: {
    full_name: string | null;
  };
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      const supabase = createClient();
      // @ts-ignore - Supabase type inference issue with reviews table
      const { data } = await supabase
        .from("reviews")
        .select("*, user:users(full_name)")
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (data) {
        setReviews(data as Review[]);
      }
      setLoading(false);
    }

    fetchReviews();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Patient Reviews
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
              What our patients say about us
            </p>
          </ScrollReveal>

          {loading ? (
            <div className="text-center py-12">Loading reviews...</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review, index) => (
                <ScrollReveal key={review.id} delay={index * 0.1}>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center mb-4">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      {review.is_verified && (
                        <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                          Verified
                        </span>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                      {review.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {review.content}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      — {review.user?.full_name || "Anonymous"}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
