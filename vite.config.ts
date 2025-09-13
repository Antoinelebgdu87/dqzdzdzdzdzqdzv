import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: (() => {
    const cfg: any = {
      host: "::",
      port: 8080,
      fs: {
        allow: ["./client", "./shared"],
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
      },
    };

    // If running behind a secure external preview host (like *.fly.dev),
    // the runtime may require the HMR client to connect over wss on port 443.
    // We detect common preview host patterns and set HMR accordingly to avoid
    // "Invalid frame header" websocket errors when the proxy expects wss.
    try {
      const previewHost = process.env.VITE_PREVIEW_HOST || process.env.HOSTNAME || "";
      if (previewHost.includes("fly.dev") || previewHost.includes("netlify.app") || previewHost.includes("vercel.app")) {
        cfg.hmr = {
          protocol: "wss",
          clientPort: 443,
          // keep host undefined so client connects to current host
        };
      }
    } catch (e) {
      // ignore
    }

    return cfg;
  })(),
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      const mod: any = await import("./server");
      const app = await mod.createServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);
    },
  };
}
