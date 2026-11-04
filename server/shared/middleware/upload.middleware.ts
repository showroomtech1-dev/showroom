// Multipart parsing. Always memory storage (files never touch the server disk) — buffers go
// straight to StorageService. MIME type and size are enforced before the controller runs.
import type { Request } from "express";
import multer, { type FileFilterCallback } from "multer";
import { AppError } from "../errors/AppError";

const memoryStorage = multer.memoryStorage();

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOCUMENT_TYPES = [
  ...IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function filterFor(allowed: string[], label: string) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(`Only ${label} files are allowed`, 422));
  };
}

/** Tags the handler with its multipart field name (lets route tooling see which routes take files). */
const marker = <T extends object>(fn: T, field: string, multiple = false) => Object.assign(fn, { __upload: { field, multiple } });

/** One image (product photo, staff photo, logo). */
export function uploadImage(field: string, maxMb = 5) {
  return marker(
    multer({
      storage: memoryStorage,
      limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
      fileFilter: filterFor(IMAGE_TYPES, "JPEG, PNG, WebP or GIF image"),
    }).single(field),
    field
  );
}

/** Several images at once. */
export function uploadImages(field: string, maxCount = 6, maxMb = 5) {
  return marker(
    multer({
      storage: memoryStorage,
      limits: { fileSize: maxMb * 1024 * 1024, files: maxCount },
      fileFilter: filterFor(IMAGE_TYPES, "JPEG, PNG, WebP or GIF image"),
    }).array(field, maxCount),
    field,
    true
  );
}

/** One receipt / proof / document — images, PDF or Word. */
export function uploadDocument(field: string, maxMb = 10) {
  return marker(
    multer({
      storage: memoryStorage,
      limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
      fileFilter: filterFor(DOCUMENT_TYPES, "image, PDF or Word"),
    }).single(field),
    field
  );
}

export function requireFile(req: Request): Express.Multer.File {
  if (!req.file) throw AppError.unprocessable("A file is required", [{ field: "file", message: "Attach a file" }]);
  return req.file;
}

export function requireFiles(req: Request): Express.Multer.File[] {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw AppError.unprocessable("At least one file is required");
  return files;
}
