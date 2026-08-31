import multer from "multer";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB — adjust to taste

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});
