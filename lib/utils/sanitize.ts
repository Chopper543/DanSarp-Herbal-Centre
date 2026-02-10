import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param dirty - Unsanitized HTML string
 * @param options - DOMPurify configuration options
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  dirty: string,
  options?: {
    allowImages?: boolean;
    allowLinks?: boolean;
    allowTables?: boolean;
  }
): string {
  const allowedTags = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "span",
    "div",
  ];

  const allowedAttributes: Record<string, string[]> = {
    "*": [],
  };

  // Allow images if specified
  if (options?.allowImages) {
    allowedTags.push("img");
    allowedAttributes.img = ["src", "alt", "title", "width", "height"];
  }

  // Allow links if specified
  if (options?.allowLinks) {
    allowedTags.push("a");
    allowedAttributes.a = ["href", "title", "target", "rel"];
  }

  // Allow tables if specified
  if (options?.allowTables) {
    allowedTags.push("table", "thead", "tbody", "tr", "th", "td");
    allowedAttributes.td = ["colspan", "rowspan"];
    allowedAttributes.th = ["colspan", "rowspan"];
  }

  return String(
    DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: Object.values(allowedAttributes).flat(),
    // Allow common safe URI protocols for links and images.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    } as any)
  );
}

/**
 * Sanitizes HTML for blog posts (allows more formatting)
 */
export function sanitizeBlogContent(html: string): string {
  return sanitizeHtml(html, {
    allowImages: true,
    allowLinks: true,
    allowTables: true,
  });
}

/**
 * Sanitizes plain text (removes all HTML)
 */
export function sanitizeText(text: string): string {
  return String(
    DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    } as any)
  );
}
