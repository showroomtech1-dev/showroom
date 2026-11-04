// Deny-by-default enforcement. Walks the Express router tree at boot; any route without a guard
// from can.ts gets a 403 handler spliced in front of it and is logged.
import type { Application, NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { isGuard, type GuardInfo } from "./can";

interface ExpressLayer {
  name?: string;
  handle: unknown;
  method?: string;
  regexp?: RegExp;
  route?: ExpressRoute;
}

interface ExpressRoute {
  path: string;
  methods: Record<string, boolean>;
  stack: ExpressLayer[];
}

export interface AuditedRoute {
  method: string;
  path: string;
  guard: GuardInfo | null;
  handlers: unknown[];
}

interface FoundRoute extends AuditedRoute {
  route: ExpressRoute;
}

/** Recover the mount path from an Express 4 router regexp such as ^\/api\/v1\/suppliers\/?(?=\/|$) */
function mountPath(layer: ExpressLayer): string {
  const source = layer.regexp?.source ?? "";
  const trimmed = source.replace(/^\^/, "").replace("\\/?(?=\\/|$)", "");
  const path = trimmed.split("\\/").join("/");
  return path === "/" ? "" : path.replace(/\/$/, "");
}

function walk(stack: ExpressLayer[], prefix: string, out: FoundRoute[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const handlers = layer.route.stack.map((l) => l.handle);
      const guardFn = handlers.find(isGuard);
      for (const method of Object.keys(layer.route.methods)) {
        out.push({
          method: method.toUpperCase(),
          path: `${prefix}${layer.route.path}`,
          guard: guardFn ? guardFn.__guard : null,
          handlers,
          route: layer.route,
        });
      }
    } else if (layer.name === "router" && typeof layer.handle === "function") {
      const inner = (layer.handle as { stack?: ExpressLayer[] }).stack;
      if (inner) walk(inner, `${prefix}${mountPath(layer)}`, out);
    }
  }
}

function collect(app: Application): FoundRoute[] {
  const router = (app as unknown as { _router?: { stack: ExpressLayer[] } })._router;
  const out: FoundRoute[] = [];
  if (router) walk(router.stack, "", out);
  return out;
}

export function listRoutes(app: Application): AuditedRoute[] {
  return collect(app).map(({ route: _route, ...rest }) => rest);
}

const deny = (_req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.forbidden("This route has no access rule and is blocked"));
};

/** Splice a deny handler onto every unguarded route. Returns the routes that were blocked. */
export function enforceRouteGuards(app: Application): string[] {
  const blocked: string[] = [];
  for (const entry of collect(app)) {
    if (entry.guard) continue;
    const first = entry.route.stack[0];
    if (first && first.handle !== deny) {
      const LayerCtor = first.constructor as new (path: string, opts: object, fn: unknown) => ExpressLayer;
      const layer = new LayerCtor("/", {}, deny);
      layer.method = first.method;
      entry.route.stack.unshift(layer);
    }
    blocked.push(`${entry.method} ${entry.path}`);
  }
  if (blocked.length > 0) {
    console.warn(`[routeAudit] ${blocked.length} route(s) had no access guard and were blocked:\n  ${blocked.join("\n  ")}`);
  }
  return blocked;
}
