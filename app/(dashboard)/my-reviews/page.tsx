"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Star, Edit, Trash2, CheckCircle, Clock, Plus, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { getUserRole, isUserOnly } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rating: 0,
    title: "",
    content: "",
  });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkRole() {
      const role = await getUserRole();
      setUserRole(role);
      setCheckingRole(false);

      if (!isUserOnly(role)) {
        router.push("/dashboard");
        return;
      }

      fetchReviews();
    }
    checkRole();
  }, [router]);

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

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.rating || !formData.title.trim() || !formData.content.trim()) {
      alert("Please fill in all fields including rating");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: formData.rating,
          title: formData.title.trim(),
          content: formData.content.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit review");
      }

      // Reset form and close modal
      setFormData({ rating: 0, title: "", content: "" });
      setShowReviewForm(false);
      setHoveredRating(0);
      
      // Refresh reviews list
      fetchReviews();
      
      alert("Review submitted successfully! It will be visible after admin approval.");
    } catch (error: any) {
      alert("Failed to submit review: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isUserOnly(userRole)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Staff members cannot leave reviews. Please use the admin panel.
          </p>
        </div>
      </div>
    );
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
          <div className="flex gap-3">
            <button
              onClick={() => setShowReviewForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Write Review
            </button>
            <Link
              href="/reviews"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              View All Reviews
            </Link>
          </div>
        </div>

        {/* Review Submission Form Modal */}
        {showReviewForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Write a Review
                </h2>
                <button
                  onClick={() => {
                    setShowReviewForm(false);
                    setFormData({ rating: 0, title: "", content: "" });
                    setHoveredRating(0);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-6">
                {/* Rating Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rating <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= (hoveredRating || formData.rating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300 dark:text-gray-600"
                          }`}
                        />
                      </button>
                    ))}
                    {formData.rating > 0 && (
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                        {formData.rating} {formData.rating === 1 ? "star" : "stars"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    maxLength={200}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Give your review a title..."
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Review <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    required
                    rows={6}
                    maxLength={2000}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Share your experience with DanSarp Herbal Centre..."
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formData.content.length}/2000 characters
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={submitting || !formData.rating || !formData.title.trim() || !formData.content.trim()}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReviewForm(false);
                      setFormData({ rating: 0, title: "", content: "" });
                      setHoveredRating(0);
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't submitted any reviews yet.
            </p>
            <button
              onClick={() => setShowReviewForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Write Your First Review
            </button>
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
