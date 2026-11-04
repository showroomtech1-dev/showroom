// The ONLY layer that talks to Cloudinary. Controllers pass buffers to services; services call this.
import type { UploadApiOptions } from "cloudinary";
import { cloudinary, storageConfigured } from "../../infrastructure/storage/cloudinaryClient";
import { AppError } from "../errors/AppError";

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
}

export interface UploadOptions {
  folder: string;
  /** Images are resized; documents (PDF/Word) are stored as-is. */
  kind?: "image" | "document";
  maxDimension?: number;
}

export class StorageService {
  static Instance = new StorageService();
  private constructor() {}

  private assertConfigured(): void {
    if (!storageConfigured) {
      throw AppError.unavailable("File storage is not configured. Add the CLOUDINARY_* settings to enable uploads.");
    }
  }

  async upload(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    this.assertConfigured();
    const isImage = (options.kind ?? "image") === "image";
    const maxDimension = options.maxDimension ?? 1600;
    const uploadOptions: UploadApiOptions = {
      folder: options.folder,
      resource_type: isImage ? "image" : "auto",
      overwrite: true,
      ...(isImage
        ? {
            transformation: [
              { width: maxDimension, height: maxDimension, crop: "limit" },
              { quality: "auto", fetch_format: "auto" },
            ],
          }
        : {}),
    };
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error || !result) {
          reject(new AppError("File upload failed", 502));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id, format: result.format, bytes: result.bytes });
      });
      stream.end(buffer);
    });
  }

  async delete(publicId: string | null | undefined): Promise<void> {
    if (!publicId || !storageConfigured) return;
    await cloudinary.uploader.destroy(publicId).catch(() => undefined);
  }

  /** Upload the new file first, then delete the old one — a failed upload never loses the old file. */
  async replace(buffer: Buffer, options: UploadOptions, oldPublicId?: string | null): Promise<UploadResult> {
    const result = await this.upload(buffer, options);
    if (oldPublicId && oldPublicId !== result.publicId) await this.delete(oldPublicId);
    return result;
  }
}
