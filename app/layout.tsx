import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { generateMetadata as generateSeoMetadata } from "@/lib/seo/metadata";
import { generateMedicalBusinessStructuredData } from "@/lib/seo/structured-data";
import { Analytics } from "@/components/analytics/Analytics";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  preload: false, // Only preload primary font
  adjustFontFallback: true,
});

export const metadata: Metadata = generateSeoMetadata({
  title: "DanSarp Herbal Centre - Certified Professional Herbal Clinic",
  description: "Restoring Health. Naturally. Your Healing Journey Begins Here.",
  keywords: ["herbal medicine", "natural healing", "holistic health", "Ghana", "herbal clinic"],
  type: "website",
  siteName: "DanSarp Herbal Centre",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dansarpherbal.com";
  const structuredData = generateMedicalBusinessStructuredData({
    name: "DanSarp Herbal Centre",
    url: siteUrl,
    description: "Certified Professional Herbal Clinic - Restoring Health. Naturally.",
    medicalSpecialty: "Herbal Medicine",
  });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const shouldBeDark = theme === 'dark' || (!theme && prefersDark);
                  if (shouldBeDark) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <ThemeProvider>
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
