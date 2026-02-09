import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  StorageBucket,
  validateFile,
  generateFilePath,
  DEFAULT_ALLOWED_TYPES,
} from "@/lib/storage/upload";
import { logger } from "@/lib/monitoring/logger";

const ALLOWED_EXTENSIONS: Record<StorageBucket, string[]> = {
  "lab-results": ["pdf", "jpeg", "jpg", "png", "doc", "docx"],
  "clinical-notes": ["pdf", "jpeg", "jpg", "png", "doc", "docx"],
  "intake-forms": ["pdf", "jpeg", "jpg", "png", "doc", "docx"],
};

function hasAllowedExtension(file: File, bucket: StorageBucket): boolean {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ALLOWED_EXTENSIONS[bucket].includes(ext);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = formData.get("bucket") as StorageBucket;
    const folder = formData.get("folder") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!bucket || !["lab-results", "clinical-notes", "intake-forms"].includes(bucket)) {
      return NextResponse.json({ error: "Invalid bucket specified" }, { status: 400 });
    }

    if (!hasAllowedExtension(file, bucket)) {
      return NextResponse.json({ error: "File extension not allowed" }, { status: 400 });
    }

    if (folder && !/^[a-zA-Z0-9-_\/]{0,100}$/.test(folder)) {
      return NextResponse.json({ error: "Invalid folder path" }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file, {
      bucket,
      folder: folder || undefined,
      allowedTypes: DEFAULT_ALLOWED_TYPES[bucket],
      maxSize: 10 * 1024 * 1024, // 10MB
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // TODO: integrate AV scanning webhook/service before marking upload successful

    // Generate file path - use user ID as folder if not specified
    const filePath = generateFilePath(file, {
      bucket,
      folder: folder || user.id, // Use user ID as folder for organization
    });

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      logger.error("Storage upload error", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 400 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return NextResponse.json(
      {
        url: publicUrl,
        path: filePath,
        fileName: file.name,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Upload error", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/**
 * Delete a file from storage
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket") as StorageBucket;
    const path = searchParams.get("path");

    if (!bucket || !path) {
      return NextResponse.json({ error: "Bucket and path are required" }, { status: 400 });
    }

    if (!["lab-results", "clinical-notes", "intake-forms"].includes(bucket)) {
      return NextResponse.json({ error: "Invalid bucket specified" }, { status: 400 });
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage.from(bucket).remove([path]);

    if (deleteError) {
      logger.error("Storage delete error", deleteError);
      return NextResponse.json({ error: "Delete failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    logger.error("Delete error", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
