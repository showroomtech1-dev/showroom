// Domain error. Anything thrown that is NOT an AppError is treated as a 500 and hidden from the client.
// `data` is null everywhere except call sites that deliberately attach a recoverable payload
// (e.g. the existing record on an idempotent replay) — globalErrorHandler forwards it as-is.
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly errors: unknown[] = [],
    public readonly data: unknown = null
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message = "Bad request", errors: unknown[] = []) {
    return new AppError(message, 400, errors);
  }
  static unauthorised(message = "Unauthorised") {
    return new AppError(message, 401);
  }
  static forbidden(message = "You do not have permission to do this") {
    return new AppError(message, 403);
  }
  static notFound(message = "Not found") {
    return new AppError(message, 404);
  }
  static conflict(message = "Conflict", data: unknown = null) {
    return new AppError(message, 409, [], data);
  }
  static unprocessable(message: string, errors: unknown[] = []) {
    return new AppError(message, 422, errors);
  }
  static unavailable(message = "Service temporarily unavailable") {
    return new AppError(message, 503);
  }
}
