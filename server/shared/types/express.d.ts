import type { Actor } from "./actor";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Output of validate(schema): { body, query, params } after Zod parsing. */
      validated?: unknown;
      /** Set by authMiddleware. */
      user?: Actor;
    }
  }
}

export {};
