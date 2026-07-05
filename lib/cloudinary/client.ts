import { v2 as cloudinary } from "cloudinary";
import { logger } from "@/lib/monitoring/logger";

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  throw new Error("Cloudinary credentials are not set");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(file: File | Buffer, folder?: string) {
  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder || "dansarp-herbal",
          transformation: [
            { width: 1200, height: 1200, crop: "limit" },
            { quality: "auto" },
            { format: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      if (Buffer.isBuffer(file)) {
        uploadStream.end(file);
      } else {
        file.arrayBuffer().then((buffer) => {
          uploadStream.end(Buffer.from(buffer));
        });
      }
    });

    return uploadResult;
  } catch (error) {
    logger.error("Cloudinary upload error", error);
    throw error;
  }
}

export async function deleteImage(publicId: string) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    logger.error("Cloudinary delete error", error);
    throw error;
  }
}

export { cloudinary };
