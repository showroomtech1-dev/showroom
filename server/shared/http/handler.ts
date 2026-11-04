// Thin-controller helper: validated input in, ApiResponse out, next(err) on failure.
// Work functions may return plain data, a Paged result (adds `meta`), or a FileResult (binary download).
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z, ZodTypeAny } from "zod";
import { AppError } from "../errors/AppError";
import { ApiResponse, type PaginationMeta } from "../response/apiResponse";
import type { Actor } from "../types/actor";

export class Paged<T> {
  constructor(
    public readonly data: T[],
    public readonly meta: PaginationMeta
  ) {}

  static of<T>(result: { data: T[]; meta: PaginationMeta }): Paged<T> {
    return new Paged(result.data, result.meta);
  }
}

export class FileResult {
  constructor(
    public readonly filename: string,
    public readonly contentType: string,
    public readonly body: Buffer,
    public readonly inline = false
  ) {}
}

export interface HandlerMeta {
  message: string;
  status: number;
}

export type Handler = RequestHandler & { meta: HandlerMeta };

export function actorOf(req: Request): Actor {
  if (!req.user) throw AppError.unauthorised();
  return req.user;
}

/** Typed access to what validate(schema) produced. */
export function input<S extends ZodTypeAny>(req: Request, _schema: S): z.infer<S> {
  return req.validated as z.infer<S>;
}

export function handle(message: string, work: (req: Request) => Promise<unknown>, status = 200): Handler {
  const fn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await work(req);
      if (result instanceof FileResult) {
        const disposition = result.inline ? "inline" : "attachment";
        res.setHeader("Content-Type", result.contentType);
        res.setHeader("Content-Disposition", `${disposition}; filename="${result.filename.replace(/"/g, "")}"`);
        res.status(200).send(result.body);
        return;
      }
      if (result instanceof Paged) {
        res.status(status).json(new ApiResponse(true, message, status, result.data, [], result.meta));
        return;
      }
      res.status(status).json(new ApiResponse(true, message, status, result ?? null));
    } catch (err) {
      next(err);
    }
  };
  return Object.assign(fn, { meta: { message, status } });
}
