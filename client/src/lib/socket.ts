// One Socket.io connection per tab, opened while signed in. It tells the server which page is open
// (for the platform admin's "who's online" view) and carries live platform events to admins.
// Set VITE_SOCKET_ENABLED=false when the API runs where sockets can't (e.g. Vercel functions).
import { useSyncExternalStore } from "react"
import { io, type Socket } from "socket.io-client"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { tokenStorage } from "@/lib/storage"
import type { OnlineUser, RecentSignup } from "@/types/platform.types"

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:4000"
const ENABLED = String(import.meta.env.VITE_SOCKET_ENABLED ?? "true").toLowerCase() !== "false"
const MAX_AUTH_RETRIES = 2

export interface OfflinePayload {
  userId: string
  name: string
  businessName: string
  lastSeenAt: string
}

export interface ServerToClientEvents {
  "presence:snapshot": (list: OnlineUser[]) => void
  "presence:online": (user: OnlineUser | null) => void
  "presence:update": (user: OnlineUser | null) => void
  "presence:offline": (payload: OfflinePayload) => void
  "platform:signup": (payload: RecentSignup & { method: "form" | "google" }) => void
  "platform:login": (payload: {
    userId: string
    organizationId: string
    businessName: string
    name: string
    email: string
    roleName: string
    method: string
    ip: string | null
    at: string
  }) => void
}

export interface ClientToServerEvents {
  "presence:activity": (payload: { path: string }) => void
  "presence:list": (ack: (list: OnlineUser[]) => void) => void
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>
export type SocketStatus = "off" | "connecting" | "connected" | "disconnected"

let instance: AppSocket | null = null
let wanted = false
let authRetries = 0
let currentPath = typeof window !== "undefined" ? window.location.pathname : "/"
let status: SocketStatus = "off"
const statusListeners = new Set<() => void>()

function setStatus(next: SocketStatus) {
  if (status === next) return
  status = next
  statusListeners.forEach((l) => l())
}

/** The shared socket. Created on first use but only connected by `connectRealtime()`. */
export function getSocket(): AppSocket {
  if (instance) return instance
  const socket: AppSocket = io(SOCKET_URL, {
    autoConnect: false,
    // Read on every (re)connect, so a refreshed access token is picked up automatically.
    auth: (cb) => cb({ token: tokenStorage.getAccess(), path: currentPath }),
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
  })

  socket.on("connect", () => {
    authRetries = 0
    setStatus("connected")
  })
  socket.on("disconnect", () => setStatus(wanted ? "disconnected" : "off"))
  socket.io.on("reconnect_attempt", () => setStatus("connecting"))

  // A rejected token isn't retried by Socket.io. Refresh it once through the API (the HTTP client
  // swaps in a new token on 401) and try again.
  socket.on("connect_error", async (err) => {
    setStatus("disconnected")
    if (err.message !== "unauthorised" || !wanted || authRetries >= MAX_AUTH_RETRIES) return
    authRetries += 1
    await AuthEndpoints.me().catch(() => null)
    if (wanted && tokenStorage.getAccess()) setTimeout(() => wanted && socket.connect(), 1_000 * authRetries)
  })

  instance = socket
  return socket
}

export function connectRealtime(): void {
  if (!ENABLED || !tokenStorage.getAccess()) return
  wanted = true
  const socket = getSocket()
  if (!socket.connected) {
    setStatus("connecting")
    socket.connect()
  }
}

export function disconnectRealtime(): void {
  wanted = false
  instance?.disconnect()
  setStatus("off")
}

/** Tell the server which page this tab is on. */
export function reportPage(path: string): void {
  currentPath = path
  if (instance?.connected) instance.emit("presence:activity", { path })
}

export function useSocketStatus(): SocketStatus {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    () => status
  )
}

export const realtimeConfigured = ENABLED
