"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Star, Edit, Trash2, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // @ts-ignore - Supabase type inference issue with reviews table
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch reviews:", error);
      } else {
        setReviews(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(reviewId: string) {
    if (!confirm("Are you sure you want to delete this review?")) {
      return;
    }

    try {
      // @ts-ignore - Supabase type inference issue with reviews table
      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", reviewId);

      if (error) {
        throw error;
      }

      fetchReviews();
    } catch (error: any) {
      alert("Failed to delete review: " + error.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Reviews</h1>
          <Link
            href="/reviews"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
          >
            View All Reviews
          </Link>
        </div>

        {reviews.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't submitted any reviews yet.
            </p>
            <Link
              href="/reviews"
              className="inline-block px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
            >
              Write Your First Review
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-300 text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(review.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {review.title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">{review.content}</p>
                    <div className="flex items-center gap-4">
                      {review.is_approved ? (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          <span>Approved</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
                          <Clock className="w-4 h-4" />
                          <span>Pending Approval</span>
                        </div>
                      )}
                      {review.is_verified && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 px-2 py-1 rounded">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  {!review.is_approved && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(review.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
