import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { generateMetadata as generateSeoMetadata } from "@/lib/seo/metadata";
import { generateMedicalBusinessStructuredData } from "@/lib/seo/structured-data";
import { Analytics } from "@/components/analytics/Analytics";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var csrfCookieName = 'csrf-token';
                  var mutatingMethods = { POST: true, PUT: true, PATCH: true, DELETE: true };
                  var originalFetch = window.fetch.bind(window);

                  function readCookie(name) {
                    var prefix = name + '=';
                    var parts = document.cookie ? document.cookie.split(';') : [];
                    for (var i = 0; i < parts.length; i++) {
                      var part = parts[i].trim();
                      if (part.indexOf(prefix) === 0) {
                        return decodeURIComponent(part.slice(prefix.length));
                      }
                    }
                    return null;
                  }

                  function resolveUrl(input) {
                    if (typeof input === 'string') return input;
                    if (input instanceof URL) return input.toString();
                    if (input && typeof input.url === 'string') return input.url;
                    return '';
                  }

                  function isSameOrigin(url) {
                    try {
                      return new URL(url, window.location.origin).origin === window.location.origin;
                    } catch (e) {
                      return false;
                    }
                  }

                  window.fetch = function(input, init) {
                    var method = (
                      (init && init.method) ||
                      (input && typeof input === 'object' && 'method' in input ? input.method : 'GET')
                    ).toUpperCase();

                    if (!mutatingMethods[method]) {
                      return originalFetch(input, init);
                    }

                    var url = resolveUrl(input);
                    if (!url || !isSameOrigin(url)) {
                      return originalFetch(input, init);
                    }

                    var headers = new Headers(
                      (init && init.headers) ||
                        (input && typeof input === 'object' && 'headers' in input ? input.headers : undefined)
                    );

                    if (!headers.has('x-csrf-token')) {
                      var token = readCookie(csrfCookieName);
                      if (token) {
                        headers.set('x-csrf-token', token);
                      }
                    }

                    return originalFetch(input, Object.assign({}, init || {}, { headers: headers }));
                  };
                } catch (e) {
                  // no-op: do not block app bootstrap if interceptor fails
                }
              })();
            `,
          }}
        />
        <ThemeProvider>
          <Toaster>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <Analytics />
          </Toaster>
        </ThemeProvider>
      </body>
    </html>
  );
}
