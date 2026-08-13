import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => {
  // Dev ergonomics only — same-origin proxy hides real CORS/CSRF behavior, so it must never be
  // what E2E or production exercise (see e2e/ and the plan's Auth & transport section, which is
  // why Playwright runs cross-origin against *.localtest.me instead of through this).
  const benchTarget = process.env.VITE_BENCH_PROXY_TARGET || "http://localhost:8000";

  return {
    server: {
      host: "0.0.0.0",
      // 5000 collides with macOS ControlCenter (AirPlay Receiver) on the loopback interface.
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/api": benchTarget,
        "/assets": benchTarget,
        "/files": benchTarget,
        "/socket.io": { target: benchTarget, ws: true },
      },
    },
    plugins: [react()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
