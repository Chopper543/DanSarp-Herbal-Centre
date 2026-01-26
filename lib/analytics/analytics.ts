/**
 * Analytics utilities for tracking user interactions
 */

// Google Analytics
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

export function trackPageView(url: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("config", process.env.NEXT_PUBLIC_GA_ID, {
      page_path: url,
    });
  }
}

// Plausible Analytics
export function trackPlausibleEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>
) {
  if (typeof window !== "undefined" && (window as any).plausible) {
    (window as any).plausible(eventName, { props });
  }
}

// Generic event tracking (works with both)
export function track(
  eventName: string,
  properties?: Record<string, any>
) {
  // Google Analytics
  if (process.env.NEXT_PUBLIC_GA_ID) {
    trackEvent(eventName, "engagement", properties?.label, properties?.value);
  }

  // Plausible
  if (process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    trackPlausibleEvent(eventName, properties);
  }
}
