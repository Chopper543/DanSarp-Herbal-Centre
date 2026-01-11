"use client";

import { Star } from "lucide-react";

interface UserRatingDisplayProps {
  rating: number;
  totalReviews: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function UserRatingDisplay({
  rating,
  totalReviews,
  showLabel = true,
  size = "md",
}: UserRatingDisplayProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`}
          />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star
              className={`${sizeClasses[size]} fill-gray-300 text-gray-300`}
            />
            <div className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
              <Star
                className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`}
              />
            </div>
          </div>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            className={`${sizeClasses[size]} fill-gray-300 text-gray-300`}
          />
        ))}
      </div>
      {showLabel && (
        <span className={`${textSizeClasses[size]} text-gray-600 dark:text-gray-400`}>
          {rating.toFixed(1)} ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
        </span>
      )}
    </div>
  );
}
