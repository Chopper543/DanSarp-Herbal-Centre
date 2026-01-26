/**
 * Content Security Policy configuration
 */

export const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.googleapis.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com https://*.gstatic.com data:;
  img-src 'self' data: https: blob: https://*.gstatic.com;
  media-src 'self' https: blob:;
  connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.paystack.co https://api.flutterwave.com https://api.vonage.com https://api.twilio.com https://resend.com https://*.cloudinary.com https://vercel.live wss://*.supabase.co wss://*.supabase.in;
  frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com https://maps.google.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, " ").trim();

/**
 * Gets CSP header for response
 */
export function getCspHeader(): string {
  return cspHeader;
}

/**
 * Gets security headers including CSP
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": getCspHeader(),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}
