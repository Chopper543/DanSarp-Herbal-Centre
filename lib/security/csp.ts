/**
 * Content Security Policy configuration.
 *
 * Production: scripts run only when tagged with the per-request nonce, plus
 * scripts loaded transitively by them ('strict-dynamic'). Inline scripts that
 * forget to render the nonce attribute will be blocked — that is the point.
 *
 * Dev: 'unsafe-eval' is required by Next's HMR runtime. Never allow it in prod.
 *
 * style-src keeps 'unsafe-inline' because Next.js/Tailwind ship hydration-time
 * inline styles. Moving styles to nonces requires patching every styled-jsx
 * usage and is out of scope for the security baseline.
 */

const CONNECT_SRCS = [
  "'self'",
  "https://*.supabase.co",
  "https://*.supabase.in",
  "https://api.paystack.co",
  "https://api.flutterwave.com",
  "https://api.vonage.com",
  "https://api.twilio.com",
  "https://resend.com",
  "https://*.cloudinary.com",
  "https://vercel.live",
  "wss://*.supabase.co",
  "wss://*.supabase.in",
];

const FRAME_SRCS = [
  "'self'",
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://www.google.com",
  "https://maps.google.com",
];

export interface CspOptions {
  nonce: string;
  isDev?: boolean;
}

export function buildCsp({ nonce, isDev = false }: CspOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://vercel.live",
    "https://*.googleapis.com",
  ];
  if (isDev) {
    // Next.js HMR runtime uses eval(); only enable for local dev.
    scriptSrc.push("'unsafe-eval'");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "https://*.gstatic.com", "data:"],
    "img-src": ["'self'", "data:", "https:", "blob:"],
    "media-src": ["'self'", "https:", "blob:"],
    "connect-src": CONNECT_SRCS,
    "frame-src": FRAME_SRCS,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(
    ([key, values]) => `${key} ${values.join(" ")}`
  );
  parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/**
 * Static security headers (everything except CSP, which is per-request).
 */
export function getStaticSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

/**
 * Back-compat: callers that want everything in one map can use this helper.
 * Always pass an explicit nonce — never default it.
 */
export function getSecurityHeaders(nonce: string, isDev = false): Record<string, string> {
  return {
    "Content-Security-Policy": buildCsp({ nonce, isDev }),
    ...getStaticSecurityHeaders(),
  };
}
