export interface UploadedFileResult {
  url: string;
  fileSize: number;
}

export interface StorageProvider {
  upload(file: Express.Multer.File): Promise<UploadedFileResult>;
  delete(url: string): Promise<void>;
}
