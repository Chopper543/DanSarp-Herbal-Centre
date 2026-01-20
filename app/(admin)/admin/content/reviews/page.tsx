"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";
import { CheckCircle, XCircle, MessageSquare, User, Calendar, Star, Search, Filter, Edit } from "lucide-react";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  title: string;
  content: string;
  is_verified: boolean;
  is_approved: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user: {
    full_name: string | null;
  } | null;
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({});
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const role = await getUserRole();
      setUserRole(role);

      if (!isAdmin(role)) {
        router.push("/admin");
        return;
      }

      fetchReviews();
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (userRole && isAdmin(userRole)) {
      fetchReviews();
    }
  }, [filter]);

  async function fetchReviews() {
    setLoading(true);
    try {
      const response = await fetch("/api/reviews?approved=false");
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateReviewStatus(reviewId: string, isApproved: boolean, notes?: string) {
    setUpdating(reviewId);
    try {
      const response = await fetch("/api/reviews", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: reviewId,
          is_approved: isApproved,
          admin_notes: notes || adminNotes[reviewId] || null,
        }),
      });

      if (response.ok) {
        await fetchReviews();
        setEditingReview(null);
        setAdminNotes((prev) => {
          const newNotes = { ...prev };
          delete newNotes[reviewId];
          return newNotes;
        });
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update review");
      }
    } catch (error) {
      console.error("Failed to update review:", error);
      alert("Failed to update review");
    } finally {
      setUpdating(null);
    }
  }

  const filteredReviews = reviews.filter((review) => {
    // Filter by status
    if (filter === "pending" && review.is_approved !== false) return false;
    if (filter === "approved" && review.is_approved !== true) return false;
    // Note: "rejected" means is_approved is explicitly false (pending reviews that were rejected)
    // For now, we'll treat rejected same as pending since we don't have a separate rejected status
    if (filter === "rejected" && review.is_approved !== false) return false;

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        review.title.toLowerCase().includes(searchLower) ||
        review.content.toLowerCase().includes(searchLower) ||
        review.user?.full_name?.toLowerCase().includes(searchLower) ||
        false
      );
    }

    return true;
  });

  const pendingCount = reviews.filter((r) => r.is_approved === false).length;
  const approvedCount = reviews.filter((r) => r.is_approved === true).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Reviews Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Moderate and approve user reviews
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {reviews.length}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                {pendingCount}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-400">Approved</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {approvedCount}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search reviews by title, content, or author..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Reviews</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {filteredReviews.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm ? "No reviews match your search" : "No reviews found"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredReviews.map((review) => (
              <div
                key={review.id}
                className={`p-6 ${
                  !review.is_approved ? "bg-yellow-50 dark:bg-yellow-900/10" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i < review.rating
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300 dark:text-gray-600"
                            }`}
                          />
                        ))}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {review.title}
                      </h3>
                      {review.is_approved ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          Approved
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                          Pending
                        </span>
                      )}
                    </div>

                    <p className="text-gray-700 dark:text-gray-300 mb-4">{review.content}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{review.user?.full_name || "Anonymous"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(review.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {review.is_verified && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          Verified
                        </span>
                      )}
                    </div>

                    {review.admin_notes && (
                      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Admin Notes:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {review.admin_notes}
                        </p>
                      </div>
                    )}

                    {editingReview === review.id && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Admin Notes (Optional)
                        </label>
                        <textarea
                          value={adminNotes[review.id] || review.admin_notes || ""}
                          onChange={(e) =>
                            setAdminNotes((prev) => ({
                              ...prev,
                              [review.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                          placeholder="Add notes about this review..."
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  {!review.is_approved ? (
                    <>
                      <button
                        onClick={() => {
                          if (editingReview !== review.id) {
                            setEditingReview(review.id);
                          } else {
                            updateReviewStatus(review.id, true);
                          }
                        }}
                        disabled={updating === review.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === review.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Updating...
                          </>
                        ) : editingReview === review.id ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Approve with Notes
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (editingReview !== review.id) {
                            setEditingReview(review.id);
                          } else {
                            updateReviewStatus(review.id, false);
                          }
                        }}
                        disabled={updating === review.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === review.id ? (
                          "Updating..."
                        ) : editingReview === review.id ? (
                          <>
                            <XCircle className="w-4 h-4" />
                            Reject with Notes
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Reject
                          </>
                        )}
                      </button>
                      {editingReview === review.id && (
                        <button
                          onClick={() => {
                            setEditingReview(null);
                            setAdminNotes((prev) => {
                              const newNotes = { ...prev };
                              delete newNotes[review.id];
                              return newNotes;
                            });
                          }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingReview(review.id);
                        setAdminNotes((prev) => ({
                          ...prev,
                          [review.id]: review.admin_notes || "",
                        }));
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Notes
                    </button>
                  )}
                  {editingReview === review.id && review.is_approved && (
                    <>
                      <button
                        onClick={() => updateReviewStatus(review.id, true)}
                        disabled={updating === review.id}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === review.id ? "Saving..." : "Save Notes"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingReview(null);
                          setAdminNotes((prev) => {
                            const newNotes = { ...prev };
                            delete newNotes[review.id];
                            return newNotes;
                          });
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </>
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
