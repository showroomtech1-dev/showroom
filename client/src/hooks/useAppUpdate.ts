import { useCallback, useEffect, useState } from "react"

const CHECK_EVERY_MS = 5 * 60_000
const RELOAD_FLAG = "showroompro_chunk_reload_at"

/**
 * Detects that a newer build has been deployed while this tab is open.
 * - Polls /version.json every few minutes and whenever the tab becomes visible / the device comes back online.
 * - If a screen's code fails to load (its file was replaced by the new deploy), reloads once to recover.
 * Nothing reloads while the user works; they are offered an "Update" button instead.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // Not in dev (no version file) — the dev server always serves the latest code.
    if (import.meta.env.DEV) return
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { version?: string }
        if (!cancelled && data.version && data.version !== __APP_VERSION__) setUpdateAvailable(true)
      } catch {
        // Offline or a hiccup — try again next time.
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", check)

    // A lazy-loaded screen 404'd because the deploy replaced its file: reload once to pick up the new build.
    const onPreloadError = (event: Event) => {
      event.preventDefault()
      setUpdateAvailable(true)
      try {
        const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0)
        if (Date.now() - last < 30_000) return // already tried moments ago — don't loop
        sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
      } catch {
        // sessionStorage unavailable: fall through to the banner only.
        return
      }
      window.location.reload()
    }
    window.addEventListener("vite:preloadError", onPreloadError)

    void check()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", check)
      window.removeEventListener("vite:preloadError", onPreloadError)
    }
  }, [])

  const applyUpdate = useCallback(async () => {
    try {
      // Make sure the newest service worker is in charge, then reload to load the new build.
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" })
    } catch {
      // Not critical.
    }
    window.location.reload()
  }, [])

  return { updateAvailable, applyUpdate }
}
