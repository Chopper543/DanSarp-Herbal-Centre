"use client";

import { useState } from "react";
import { User, Upload } from "lucide-react";
import Image from "next/image";

interface ProfileAvatarProps {
  avatarUrl: string | null;
  name: string | null;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  onUpload?: (file: File) => void;
  className?: string;
}

export function ProfileAvatar({
  avatarUrl,
  name,
  size = "md",
  editable = false,
  onUpload,
  className = "",
}: ProfileAvatarProps) {
  const [isUploading, setIsUploading] = useState(false);

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      setIsUploading(true);
      try {
        await onUpload(file);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center overflow-hidden border-2 border-gray-200 dark:border-gray-700`}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name || "User avatar"}
            width={size === "sm" ? 48 : size === "md" ? 96 : 128}
            height={size === "sm" ? 48 : size === "md" ? 96 : 128}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className={`${iconSizes[size]} text-primary-600 dark:text-primary-400 font-semibold`}
          >
            {initials}
          </span>
        )}
      </div>
      {editable && (
        <label className="absolute bottom-0 right-0 p-2 bg-primary-600 rounded-full cursor-pointer hover:bg-primary-700 transition-colors shadow-lg">
          <Upload className="w-4 h-4 text-white" />
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      )}
      {isUploading && (
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
