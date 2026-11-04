// Flaky networks sometimes fail DNS lookups (ENOTFOUND / EAI_AGAIN) for a moment. A cloud database
// (e.g. Aiven) is looked up on every new pool connection, so one blip can fail a request. This wraps
// dns.lookup: successful answers are cached for 10 minutes, and failed lookups are retried, falling
// back to the last known address. Imported once, before the database pool is created.
import dns from "dns";

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

const TTL_MS = 10 * 60_000;
const RETRIES = 4;
const RETRY_DELAY_MS = 500;
const TRANSIENT = new Set(["ENOTFOUND", "EAI_AGAIN", "ETIMEOUT", "ECONNREFUSED"]);

const original = dns.lookup.bind(dns) as (hostname: string, options: dns.LookupAllOptions | dns.LookupOneOptions, cb: LookupCallback) => void;
const cache = new Map<string, { address: string | dns.LookupAddress[]; family?: number; at: number }>();

let installed = false;

export function installResilientDns(): void {
  if (installed) return;
  installed = true;

  const resilient = (hostname: string, optionsOrCb: unknown, maybeCb?: unknown): void => {
    const callback = (typeof optionsOrCb === "function" ? optionsOrCb : maybeCb) as LookupCallback;
    const rawOptions = typeof optionsOrCb === "function" ? {} : optionsOrCb;
    const options = (typeof rawOptions === "number" ? { family: rawOptions } : (rawOptions ?? {})) as dns.LookupAllOptions | dns.LookupOneOptions;
    const key = `${hostname}|${JSON.stringify(options)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      process.nextTick(() => callback(null, hit.address, hit.family));
      return;
    }

    const attempt = (n: number): void => {
      original(hostname, options, (err, address, family) => {
        if (!err) {
          cache.set(key, { address, family, at: Date.now() });
          callback(null, address, family);
          return;
        }
        if (TRANSIENT.has(err.code ?? "") && n < RETRIES) {
          setTimeout(() => attempt(n + 1), RETRY_DELAY_MS * (n + 1));
          return;
        }
        // Still failing: use the last address we knew, if any.
        if (hit) {
          callback(null, hit.address, hit.family);
          return;
        }
        callback(err, address, family);
      });
    };
    attempt(0);
  };

  (dns as unknown as { lookup: typeof resilient }).lookup = resilient;
}
