// The ONLY file that reads process.env. Everything else imports `env`.
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const read = (key: string, fallback = ""): string => {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
};

const readInt = (key: string, fallback: number): number => {
  const parsed = Number.parseInt(read(key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readBool = (key: string, fallback: boolean): boolean => {
  const value = read(key).toLowerCase();
  if (value === "") return fallback;
  return value === "true" || value === "1" || value === "yes";
};

/** "15m", "7d", "12h", "900s" or plain seconds → seconds. Undefined when unset or unreadable. */
function readDurationSeconds(key: string): number | undefined {
  const match = /^(\d+)\s*([smhd]?)$/i.exec(read(key).trim());
  if (!match) return undefined;
  const unit = { "": 1, s: 1, m: 60, h: 3600, d: 86_400 }[match[2].toLowerCase() as "" | "s" | "m" | "h" | "d"];
  return Number(match[1]) * unit;
}

const MAX_ACCESS_TTL = 24 * 3600;
function accessTtlSeconds(): number {
  const ttl = readDurationSeconds("JWT_ACCESS_EXPIRES_IN") ?? readInt("JWT_ACCESS_TTL_SECONDS", 900);
  if (ttl > MAX_ACCESS_TTL) {
    console.warn(`[env] Access tokens of ${ttl}s are unsafe; capped at 24h. Use something like JWT_ACCESS_EXPIRES_IN=15m.`);
    return MAX_ACCESS_TTL;
  }
  return Math.max(ttl, 60);
}

function refreshTtlDays(): number {
  const seconds = readDurationSeconds("JWT_REFRESH_EXPIRES_IN");
  return seconds !== undefined ? Math.max(1, Math.round(seconds / 86_400)) : readInt("JWT_REFRESH_TTL_DAYS", 7);
}

const nodeEnv = read("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

const DEV_ACCESS_SECRET = "dev-only-access-secret-change-me-0123456789";
const DEV_REFRESH_SECRET = "dev-only-refresh-secret-change-me-0123456789";

function secret(key: string, devFallback: string): string {
  const value = read(key);
  if (value.length >= 32) return value;
  if (isProduction) {
    throw new Error(`${key} must be set to a random string of at least 32 characters in production`);
  }
  return value || devFallback;
}

// Either CLOUDINARY_URL (cloudinary://key:secret@cloud_name) or the three separate values.
function parseCloudinaryUrl(url: string): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim());
  return match ? { apiKey: match[1], apiSecret: match[2], cloudName: match[3] } : null;
}
const cloudFromUrl = parseCloudinaryUrl(read("CLOUDINARY_URL"));
const cloudName = read("CLOUDINARY_CLOUD_NAME", cloudFromUrl?.cloudName ?? "");
const cloudKey = read("CLOUDINARY_API_KEY", cloudFromUrl?.apiKey ?? "");
const cloudSecret = read("CLOUDINARY_API_SECRET", cloudFromUrl?.apiSecret ?? "");

export const env = {
  nodeEnv,
  isProduction,
  port: readInt("PORT", 4000),
  appUrl: read("APP_URL", "http://localhost:4000").replace(/\/+$/, ""),
  corsOrigins: read("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  db: {
    url: read("DATABASE_URL"),
    host: read("DB_HOST", "localhost"),
    port: readInt("DB_PORT", 5432),
    user: read("DB_USER", "postgres"),
    password: read("DB_PASSWORD", "postgres"),
    name: read("DB_NAME", "showroompro"),
    ssl: readBool("DB_SSL", false),
    logging: readBool("DB_LOGGING", false),
  },
  jwt: {
    accessSecret: secret("JWT_ACCESS_SECRET", DEV_ACCESS_SECRET),
    refreshSecret: secret("JWT_REFRESH_SECRET", DEV_REFRESH_SECRET),
    accessTtlSeconds: accessTtlSeconds(),
    refreshTtlDays: refreshTtlDays(),
  },
  bcryptRounds: readInt("BCRYPT_ROUNDS", 10),
  cloudinary: {
    cloudName,
    apiKey: cloudKey,
    apiSecret: cloudSecret,
    configured: Boolean(cloudName && cloudKey && cloudSecret),
  },
  scheduler: {
    enabled: readBool("SCHEDULER_ENABLED", true),
    intervalMinutes: readInt("SCHEDULER_INTERVAL_MINUTES", 60),
  },
} as const;
