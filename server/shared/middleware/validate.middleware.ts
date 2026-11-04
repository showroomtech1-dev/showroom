// Validation runs BEFORE the controller. Invalid input is rejected here with 422 and the
// controller is never called. Parsed output lands on req.validated = { body, query, params }.
import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodTypeAny } from "zod";
import { ApiResponse } from "../response/apiResponse";

export type ValidateHandler = ((req: Request, res: Response, next: NextFunction) => void) & { schema: ZodTypeAny };

export function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((e) => ({
    field: e.path.filter((p) => p !== "body" && p !== "query" && p !== "params").join(".") || e.path.join("."),
    message: e.message,
  }));
}

export function validate(schema: ZodTypeAny): ValidateHandler {
  const handler = (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body ?? {}, query: req.query ?? {}, params: req.params ?? {} });
    if (!result.success) {
      res.status(422).json(ApiResponse.error("Validation failed", 422, formatZodErrors(result.error)));
      return;
    }
    req.validated = result.data;
    next();
  };
  return Object.assign(handler, { schema });
}
