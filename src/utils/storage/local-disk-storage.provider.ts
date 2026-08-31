import fs from "fs/promises";
import path from "path";
import {
  StorageProvider,
  UploadedFileResult,
} from "./storage-provider.interface";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

export class LocalDiskStorageProvider implements StorageProvider {
  async upload(file: Express.Multer.File): Promise<UploadedFileResult> {
    // multer's diskStorage (see upload.middleware.ts) already wrote the
    // file to UPLOAD_DIR by the time this runs — this just builds the
    // public URL the client will use to fetch it back.
    return {
      url: `${PUBLIC_BASE_URL}/${UPLOAD_DIR}/${file.filename}`,
      fileSize: file.size,
    };
  }

  async delete(url: string): Promise<void> {
    const filePath = path.join(process.cwd(), UPLOAD_DIR, path.basename(url));
    await fs.unlink(filePath).catch(() => {
      // Already gone or never existed — an Attachment row's delete
      // shouldn't fail just because the file was manually removed.
    });
  }
}
