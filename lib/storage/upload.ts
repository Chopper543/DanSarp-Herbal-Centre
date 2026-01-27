/**
 * File upload utility for Supabase Storage
 * Handles file validation, upload, and URL generation
 */

export type StorageBucket = "lab-results" | "clinical-notes" | "intake-forms";

export interface UploadOptions {
  bucket: StorageBucket;
  folder?: string; // Optional subfolder (e.g., patient_id, appointment_id)
  maxSize?: number; // Max file size in bytes (default: 10MB)
  allowedTypes?: string[]; // Allowed MIME types
}

export interface UploadResult {
  url: string;
  path: string;
  fileName: string;
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  options: UploadOptions
): { valid: boolean; error?: string } {
  // Check file size
  const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  // Check file type if specified
  if (options.allowedTypes && options.allowedTypes.length > 0) {
    const isValidType = options.allowedTypes.some((type) => {
      if (type.endsWith("/*")) {
        // Check category (e.g., "image/*")
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${options.allowedTypes.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Generate a unique file path
 */
export function generateFilePath(file: File, options: UploadOptions): string {
  const fileExt = file.name.split(".").pop() || "";
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const fileName = `${timestamp}-${randomStr}.${fileExt}`;

  if (options.folder) {
    return `${options.folder}/${fileName}`;
  }

  return fileName;
}

/**
 * Default allowed file types for each bucket
 */
export const DEFAULT_ALLOWED_TYPES: Record<StorageBucket, string[]> = {
  "lab-results": [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  "clinical-notes": [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  "intake-forms": [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};
