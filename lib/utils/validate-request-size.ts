import { NextRequest, NextResponse } from "next/server";

/**
 * Maximum request body sizes (in bytes)
 */
export const MAX_REQUEST_SIZES = {
  // General API requests
  default: 1024 * 1024, // 1MB
  // File uploads
  fileUpload: 10 * 1024 * 1024, // 10MB
  // JSON payloads
  json: 512 * 1024, // 512KB
  // Form data
  form: 5 * 1024 * 1024, // 5MB
} as const;

/**
 * Validates request body size
 * @param request - Next.js request object
 * @param maxSize - Maximum size in bytes (default: 1MB)
 * @returns Error response if size exceeds limit, null otherwise
 */
export async function validateRequestSize(
  request: NextRequest,
  maxSize: number = MAX_REQUEST_SIZES.default
): Promise<NextResponse | null> {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSize) {
      return NextResponse.json(
        {
          error: "Request too large",
          message: `Request body size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`,
        },
        { status: 413 }
      );
    }
  }

  return null;
}

/**
 * Gets appropriate max size based on content type
 */
export function getMaxSizeForContentType(contentType: string | null): number {
  if (!contentType) {
    return MAX_REQUEST_SIZES.default;
  }

  if (contentType.includes("multipart/form-data")) {
    return MAX_REQUEST_SIZES.form;
  }

  if (contentType.includes("application/json")) {
    return MAX_REQUEST_SIZES.json;
  }

  if (contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.startsWith("audio/")) {
    return MAX_REQUEST_SIZES.fileUpload;
  }

  return MAX_REQUEST_SIZES.default;
}
