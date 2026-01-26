"use client";

import Link from "next/link";
import { MessageCircle, Facebook, Instagram, Youtube, Linkedin } from "lucide-react";
import { getAvailableSocialLinks, SocialPlatform } from "@/lib/config/social-media";

interface SocialLinksProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  platforms?: SocialPlatform[];
  variant?: "default" | "minimal" | "colored";
}

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

const containerSizes = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
};

/**
 * Get icon component for a social platform
 */
function getSocialIcon(platform: SocialPlatform, size: "sm" | "md" | "lg") {
  const iconClass = iconSizes[size];
  
  switch (platform) {
    case "whatsapp":
      return <MessageCircle className={iconClass} />;
    case "facebook":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
        </svg>
      );
    case "youtube":
      return <Youtube className={iconClass} />;
    case "tiktok":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.18 6.18 0 00-1-.05A6.07 6.07 0 005 20.97a6.07 6.07 0 0010.86-4.25v-7.92a7.84 7.84 0 004.24 1.26v-3.37a4.85 4.85 0 01-1.51-.9z" />
        </svg>
      );
    case "twitter":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "linkedin":
      return <Linkedin className={iconClass} />;
    default:
      return null;
  }
}

/**
 * Get hover color for a social platform
 */
function getHoverColor(platform: SocialPlatform, variant: "default" | "minimal" | "colored"): string {
  if (variant === "minimal") {
    return "hover:text-primary-400";
  }
  
  if (variant === "colored") {
    const colors: Record<SocialPlatform, string> = {
      whatsapp: "hover:text-green-500",
      facebook: "hover:text-blue-600",
      instagram: "hover:text-pink-500",
      youtube: "hover:text-red-600",
      tiktok: "hover:text-black dark:hover:text-white",
      twitter: "hover:text-blue-400",
      linkedin: "hover:text-blue-700",
    };
    return colors[platform] || "hover:text-primary-400";
  }
  
  return "hover:text-primary-400";
}

export function SocialLinks({
  className = "",
  size = "md",
  showLabels = false,
  platforms,
  variant = "default",
}: SocialLinksProps) {
  const allLinks = getAvailableSocialLinks();
  const linksToShow = platforms
    ? allLinks.filter((link) => platforms.includes(link.platform))
    : allLinks;

  if (linksToShow.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center ${containerSizes[size]} ${className}`}>
      {linksToShow.map((link) => {
        const icon = getSocialIcon(link.platform, size);
        const hoverColor = getHoverColor(link.platform, variant);
        
        return (
          <Link
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
              flex items-center ${containerSizes[size]}
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded
              min-h-[44px] min-w-[44px]
              ${variant === "default" ? "text-gray-300 hover:text-white" : ""}
              ${variant === "minimal" ? "text-gray-400 hover:text-primary-400" : ""}
              ${variant === "colored" ? "text-gray-300" : ""}
              ${hoverColor}
            `}
            aria-label={`Visit our ${link.label} page`}
          >
            {icon}
            {showLabels && (
              <span className="text-sm font-medium">{link.label}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
