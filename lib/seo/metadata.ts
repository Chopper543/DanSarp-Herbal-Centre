import { Metadata } from "next";

export interface SeoMetadata {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  siteName?: string;
}

/**
 * Generates comprehensive metadata for SEO
 */
export function generateMetadata(seo: SeoMetadata): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dansarpherbal.com";
  const siteName = seo.siteName || "DanSarp Herbal Centre";
  const imageUrl = seo.image || `${siteUrl}/og-image.jpg`;
  const pageUrl = seo.url || siteUrl;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords || ["herbal medicine", "natural healing", "holistic health", "Ghana", "herbal clinic"],
    authors: [{ name: seo.author || "DanSarp Herbal Centre" }],
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: pageUrl,
      siteName: siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: seo.title,
        },
      ],
      locale: "en_US",
      type: seo.type || "website",
      ...(seo.publishedTime && { publishedTime: seo.publishedTime }),
      ...(seo.modifiedTime && { modifiedTime: seo.modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [imageUrl],
      creator: "@dansarpherbal",
    },
    alternates: {
      canonical: pageUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}
