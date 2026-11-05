// Socket.io for live presence. Every signed-in tab connects with its access token; platform admins
// (PLATFORM_ADMIN_EMAILS) also join the admin room and get pushed who comes online / goes offline,
// sign-ins and new businesses as they happen.
//
// Server → admin room:  presence:snapshot · presence:online · presence:update · presence:offline
//                       platform:signup · platform:login
// Client → server:      presence:activity { path }   ·   presence:list (ack) — admins only
import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { resolveActor } from "../../modules/auth/services/actorResolver";
import { markSeen } from "../../modules/platform/services/lastSeen";
import { PlatformRepository } from "../../modules/platform/repositories/platform.repository";
import { setRealtimeEnabled } from "../../modules/platform/services/realtimeState";
import { isPlatformAdmin } from "../../shared/access/can";
import { domainEvents } from "../../shared/events/domainEvents";
import { isAllowedOrigin } from "../../shared/http/cors";
import type { Actor } from "../../shared/types/actor";
import { verifyAccessToken } from "../../shared/utils/jwt";
import type { RecentSignupDTO } from "../../modules/platform/dto/platform.dto";
import { describeDevice, presence, type OnlineUserDTO, type PresenceProfile } from "./presence";

export const PLATFORM_ROOM = "platform-admins";
const ACTIVITY_MIN_INTERVAL_MS = 1_000;

interface SocketData {
  actor: Actor;
  isPlatformAdmin: boolean;
  lastActivityAt: number;
}

interface OfflinePayload {
  userId: string;
  name: string;
  businessName: string;
  lastSeenAt: string;
}

interface ServerToClientEvents {
  "presence:snapshot": (list: OnlineUserDTO[]) => void;
  "presence:online": (user: OnlineUserDTO | null) => void;
  "presence:update": (user: OnlineUserDTO | null) => void;
  "presence:offline": (payload: OfflinePayload) => void;
  "platform:signup": (payload: RecentSignupDTO & { method: "form" | "google" }) => void;
  "platform:login": (payload: PresenceProfile & { method: string; ip: string | null; at: string }) => void;
}

interface ClientToServerEvents {
  "presence:activity": (payload: { path?: unknown } | undefined) => void;
  "presence:list": (ack: (list: OnlineUserDTO[]) => void) => void;
}

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

let io: AppServer | null = null;

function cleanPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().slice(0, 200);
  return path.startsWith("/") ? path : null;
}

function clientIp(socket: AppSocket): string | null {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || socket.handshake.address || null;
}

function toAdmins<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
  io?.to(PLATFORM_ROOM).emit(event, ...args);
}

async function onConnection(socket: AppSocket): Promise<void> {
  const { actor } = socket.data;
  const profile = await PlatformRepository.Instance.presenceProfile(actor.id).catch(() => null);
  if (!profile || socket.disconnected) {
    socket.disconnect(true);
    return;
  }

  void socket.join([`user:${actor.id}`, `org:${actor.organizationId}`]);
  const cameOnline = presence.connect(socket.id, profile, {
    device: describeDevice(socket.handshake.headers["user-agent"]),
    ip: clientIp(socket),
    path: cleanPath(socket.handshake.auth?.path),
  });
  markSeen(actor.id, { force: cameOnline });
  toAdmins(cameOnline ? "presence:online" : "presence:update", presence.get(actor.id));

  if (socket.data.isPlatformAdmin) {
    void socket.join(PLATFORM_ROOM);
    socket.emit("presence:snapshot", presence.list());
    socket.on("presence:list", (ack) => {
      if (typeof ack === "function") ack(presence.list());
    });
  }

  socket.on("presence:activity", (payload) => {
    const now = Date.now();
    if (now - socket.data.lastActivityAt < ACTIVITY_MIN_INTERVAL_MS) return;
    socket.data.lastActivityAt = now;
    presence.activity(actor.id, socket.id, cleanPath(payload?.path));
    markSeen(actor.id);
    toAdmins("presence:update", presence.get(actor.id));
  });

  socket.on("disconnect", () => {
    const wentOffline = presence.disconnect(actor.id, socket.id);
    markSeen(actor.id, { force: wentOffline });
    if (wentOffline) {
      toAdmins("presence:offline", {
        userId: actor.id,
        name: profile.name,
        businessName: profile.businessName,
        lastSeenAt: new Date().toISOString(),
      });
    } else {
      toAdmins("presence:update", presence.get(actor.id));
    }
  });
}

function registerDomainEventForwarding(): void {
  domainEvents.on("business.registered", async ({ organizationId, method }) => {
    const summary = await PlatformRepository.Instance.signupSummary(organizationId);
    if (summary) toAdmins("platform:signup", { ...summary, method });
  });

  domainEvents.on("auth.signedIn", async ({ userId, method, ip }) => {
    const profile = await PlatformRepository.Instance.presenceProfile(userId);
    if (profile) toAdmins("platform:login", { ...profile, method, ip, at: new Date().toISOString() });
  });
}

export function attachSocketServer(httpServer: HttpServer): AppServer {
  io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // The token is checked once, when the connection opens. The client reconnects with a fresh
  // token after a refresh, so an expired token can't open a new connection.
  io.use(async (socket: AppSocket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !token) throw new Error("missing token");
      const payload = verifyAccessToken(token);
      const actor = await resolveActor(payload.sub, payload.org);
      if (!actor) throw new Error("inactive");
      socket.data.actor = actor;
      socket.data.isPlatformAdmin = isPlatformAdmin(actor);
      socket.data.lastActivityAt = 0;
      next();
    } catch {
      next(new Error("unauthorised"));
    }
  });

  io.on("connection", (socket: AppSocket) => {
    onConnection(socket).catch((err) => {
      console.error("[socket] connection setup failed", err);
      socket.disconnect(true);
    });
  });

  registerDomainEventForwarding();
  setRealtimeEnabled(true);
  return io;
}

export function closeSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => resolve());
    io = null;
  });
}
