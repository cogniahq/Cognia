import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "./",
  server: {
    host: process.env.VITE_DEV_HOST || "localhost",
    port: Number(process.env.VITE_DEV_PORT || 5173),
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        // Required for SSE to work - disable response buffering
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            // Check if this is an SSE request
            if (req.url?.includes("/stream")) {
              proxyReq.setHeader("Accept", "text/event-stream")
            }
          })
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
