// Live presence for the platform admin page: who is online right now (pushed by the server) and a
// running feed of sign-ups, sign-ins and people coming online / going offline since the page opened.
import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getSocket, useSocketStatus } from "@/lib/socket"
import { pageLabel } from "@/lib/time"
import type { LiveEvent, OnlineUser } from "@/types/platform.types"
import { PLATFORM_KEY } from "./usePlatform"

const FEED_LIMIT = 80

export function usePlatformLive() {
  const qc = useQueryClient()
  const status = useSocketStatus()
  const [online, setOnline] = useState<Map<string, OnlineUser>>(new Map())
  const [feed, setFeed] = useState<LiveEvent[]>([])
  const seq = useRef(0)

  useEffect(() => {
    const socket = getSocket()
    const push = (e: Omit<LiveEvent, "id">) => {
      seq.current += 1
      const id = `${Date.now()}-${seq.current}`
      setFeed((prev) => [{ ...e, id }, ...prev].slice(0, FEED_LIMIT))
    }
    const upsert = (u: OnlineUser | null) => {
      if (!u) return
      setOnline((prev) => new Map(prev).set(u.userId, u))
    }
    const refreshLists = () => qc.invalidateQueries({ queryKey: [PLATFORM_KEY] })

    const onSnapshot = (list: OnlineUser[]) => setOnline(new Map(list.map((u) => [u.userId, u])))
    const onOnline = (u: OnlineUser | null) => {
      upsert(u)
      if (u) push({ kind: "online", at: new Date().toISOString(), title: `${u.name} came online`, detail: `${u.businessName} · ${pageLabel(u.currentPath)} · ${u.device}` })
    }
    const onOffline = (p: { userId: string; name: string; businessName: string; lastSeenAt: string }) => {
      setOnline((prev) => {
        const next = new Map(prev)
        next.delete(p.userId)
        return next
      })
      push({ kind: "offline", at: p.lastSeenAt, title: `${p.name} went offline`, detail: p.businessName })
    }
    const onSignup = (p: { name: string; ownerName: string | null; ownerEmail: string | null; method: string; createdAt: string }) => {
      push({
        kind: "signup",
        at: new Date().toISOString(),
        title: `New business: ${p.name}`,
        detail: `${p.ownerName ?? "Owner"}${p.ownerEmail ? ` · ${p.ownerEmail}` : ""}${p.method === "google" ? " · via Google" : ""}`,
      })
      toast.success(`New sign-up: ${p.name}`)
      refreshLists()
    }
    const onLogin = (p: { name: string; email: string; businessName: string; method: string; at: string }) => {
      push({ kind: "login", at: p.at, title: `${p.name} signed in`, detail: `${p.businessName} · ${p.email}${p.method === "google" ? " · Google" : ""}` })
    }

    socket.on("presence:snapshot", onSnapshot)
    socket.on("presence:online", onOnline)
    socket.on("presence:update", upsert)
    socket.on("presence:offline", onOffline)
    socket.on("platform:signup", onSignup)
    socket.on("platform:login", onLogin)
    // The snapshot is only pushed when the connection opens; ask for it if we're already connected.
    if (socket.connected) socket.emit("presence:list", onSnapshot)

    return () => {
      socket.off("presence:snapshot", onSnapshot)
      socket.off("presence:online", onOnline)
      socket.off("presence:update", upsert)
      socket.off("presence:offline", onOffline)
      socket.off("platform:signup", onSignup)
      socket.off("platform:login", onLogin)
    }
  }, [qc])

  const onlineList = useMemo(
    () => [...online.values()].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt)),
    [online]
  )
  const onlineByOrg = useMemo(() => {
    const counts = new Map<string, number>()
    for (const u of online.values()) counts.set(u.organizationId, (counts.get(u.organizationId) ?? 0) + 1)
    return counts
  }, [online])

  return { status, connected: status === "connected", online, onlineList, onlineByOrg, feed }
}

export type PlatformLive = ReturnType<typeof usePlatformLive>
