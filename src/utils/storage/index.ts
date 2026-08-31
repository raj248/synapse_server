import { StorageProvider } from "./storage-provider.interface";
import { LocalDiskStorageProvider } from "./local-disk-storage.provider";
// import { S3StorageProvider } from "./s3-storage.provider"; // add when ready

// Swap the implementation here (or branch on process.env.STORAGE_PROVIDER)
// and every route using `storageProvider` picks up the new backend with
// zero changes anywhere else.
export const storageProvider: StorageProvider = new LocalDiskStorageProvider();
