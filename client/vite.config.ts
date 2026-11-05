import path from "path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Identifies this build. Vercel provides the commit; otherwise fall back to the build time.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? String(Date.now())

/** Writes /version.json next to the app so open tabs can detect that a newer build was deployed. */
function emitVersionFile(): Plugin {
  return {
    name: "emit-version-file",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: APP_VERSION }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), emitVersionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
      "sonner",
      "html5-qrcode",
    ],
  },
  server: {
    port: 5173,
    host: true,
  },
})
