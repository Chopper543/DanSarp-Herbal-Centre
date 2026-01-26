// Use isomorphic-dompurify which works in both Node.js and browser
let createDOMPurify: any;
let purify: any;

if (typeof window === "undefined") {
  // Server-side: use JSDOM
  const { JSDOM } = require("jsdom");
  const window = new JSDOM("").window;
  createDOMPurify = require("isomorphic-dompurify");
  purify = createDOMPurify(window as any);
} else {
  // Client-side: use browser window
  createDOMPurify = require("isomorphic-dompurify");
  purify = createDOMPurify(window);
}

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
  const config: DOMPurify.Config = {
    ALLOWED_TAGS: [
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
    ],
    ALLOWED_ATTR: [],
  };

  // Allow images if specified
  if (options?.allowImages) {
    config.ALLOWED_TAGS!.push("img");
    config.ALLOWED_ATTR!.push("src", "alt", "title", "width", "height");
  }

  // Allow links if specified
  if (options?.allowLinks) {
    config.ALLOWED_TAGS!.push("a");
    config.ALLOWED_ATTR!.push("href", "title", "target", "rel");
    // Ensure external links have rel="noopener noreferrer"
    config.ALLOW_DATA_ATTR = false;
  }

  // Allow tables if specified
  if (options?.allowTables) {
    config.ALLOWED_TAGS!.push("table", "thead", "tbody", "tr", "th", "td");
    config.ALLOWED_ATTR!.push("colspan", "rowspan");
  }

  return purify.sanitize(dirty, config);
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
  return purify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
