import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// `vite dev` runs the PWA and the Worker (with local D1) together.
// `vite build` outputs both, ready for `wrangler deploy`.
export default defineConfig({
  plugins: [cloudflare()],
});
