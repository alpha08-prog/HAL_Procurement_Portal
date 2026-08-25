import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.STORAGE_PATH 
  ? path.resolve(here, process.env.STORAGE_PATH) 
  : path.join(here, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage config: keeps original extension, uses crypto UUID for uniqueness
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB max per file
  }
});

// Computes SHA-256 checksum for a file on disk
export const computeFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
};

export const getStoragePath = () => uploadDir;

export default {
  upload,
  computeFileHash,
  getStoragePath
};
