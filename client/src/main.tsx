import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { AuthProvider } from "@/contexts/AuthContext"
import { Toaster } from "@/components/ui/sonner"
import App from "./App"
import "./index.css"

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration is non-fatal
      })
    })
  } else {
    // In development, unregister any previously installed service worker and clear its asset caches
    // so Vite's pre-bundled dependency chunks (/node_modules/.vite/deps) are never mixed across hashes.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister()
      }
    })
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          if (key.startsWith("showroompro-pwa")) {
            caches.delete(key)
          }
        }
      })
    }
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
