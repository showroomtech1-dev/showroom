import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { QueryFailedError } from "typeorm";
import { AppError } from "../errors/AppError";
import { ApiResponse } from "../response/apiResponse";

function pgCode(err: unknown): string | undefined {
  if (err instanceof QueryFailedError) {
    const driverError = (err as QueryFailedError & { driverError?: { code?: string } }).driverError;
    return driverError?.code;
  }
  return undefined;
}

export function globalErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(new ApiResponse(false, err.message, err.statusCode, err.data ?? null, err.errors));
    return;
  }

  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 422;
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : "Invalid file upload";
    res.status(status).json(ApiResponse.error(message, status, [{ field: err.field ?? "file", message: err.message }]));
    return;
  }

  const bodyParserType = (err as { type?: string } | null)?.type;
  if (bodyParserType === "entity.parse.failed") {
    res.status(400).json(ApiResponse.error("Malformed JSON body", 400));
    return;
  }
  if (bodyParserType === "entity.too.large") {
    res.status(413).json(ApiResponse.error("Request body is too large", 413));
    return;
  }

  switch (pgCode(err)) {
    case "23505":
      res.status(409).json(ApiResponse.error("A record with these details already exists", 409));
      return;
    case "23503":
      res.status(409).json(ApiResponse.error("This record is linked to other records", 409));
      return;
    case "23514":
      res.status(422).json(ApiResponse.error("A value is outside the allowed range", 422));
      return;
    case "22P02":
      res.status(400).json(ApiResponse.error("Invalid identifier", 400));
      return;
    default:
      break;
  }

  // Never expose internal error details to the client.
  console.error("[Unhandled Error]", err);
  res.status(500).json(ApiResponse.error("Internal server error", 500));
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(ApiResponse.error(`Route ${req.method} ${req.path} not found`, 404));
}
