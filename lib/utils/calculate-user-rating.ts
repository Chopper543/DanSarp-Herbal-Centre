import { createClient } from "@/lib/supabase/server";

export interface UserRating {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export async function calculateUserRating(userId: string): Promise<UserRating> {
  const supabase = await createClient();

  // @ts-ignore - Supabase type inference issue with reviews table
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("user_id", userId)
    .eq("is_approved", true);

  if (error || !reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
    };
  }

  const typedReviews = reviews as Array<{ rating: number }>;
  const totalReviews = typedReviews.length;
  const sum = typedReviews.reduce((acc, review) => acc + review.rating, 0);
  const averageRating = totalReviews > 0 ? sum / totalReviews : 0;

  const ratingBreakdown = {
    5: typedReviews.filter((r) => r.rating === 5).length,
    4: typedReviews.filter((r) => r.rating === 4).length,
    3: typedReviews.filter((r) => r.rating === 3).length,
    2: typedReviews.filter((r) => r.rating === 2).length,
    1: typedReviews.filter((r) => r.rating === 1).length,
  };

  return {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    totalReviews,
    ratingBreakdown,
  };
}
