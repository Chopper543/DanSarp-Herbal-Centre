/**
 * Social Media Configuration
 * Centralized configuration for social media links
 */

export type SocialPlatform =
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "twitter"
  | "linkedin";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  label: string;
  icon?: string;
}

/**
 * Get social media URLs from environment variables
 */
export function getSocialMediaUrls(): Partial<Record<SocialPlatform, string>> {
  return {
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL || `https://wa.me/233246906739`,
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL || "",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "",
    twitter: process.env.NEXT_PUBLIC_TWITTER_URL || "",
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL || "",
  };
}

/**
 * Get all available social media links (only those with URLs)
 */
export function getAvailableSocialLinks(): SocialLink[] {
  const urls = getSocialMediaUrls();
  const links: SocialLink[] = [];

  const platformLabels: Record<SocialPlatform, string> = {
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    twitter: "Twitter",
    linkedin: "LinkedIn",
  };

  (Object.keys(urls) as SocialPlatform[]).forEach((platform) => {
    const url = urls[platform];
    if (url && url.trim() !== "") {
      links.push({
        platform,
        url: url.trim(),
        label: platformLabels[platform],
      });
    }
  });

  return links;
}

/**
 * Get a specific social media URL
 */
export function getSocialMediaUrl(platform: SocialPlatform): string | undefined {
  const urls = getSocialMediaUrls();
  return urls[platform];
}
