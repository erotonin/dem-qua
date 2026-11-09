import { defineConfig } from "vitest/config";

// Unit tests run in plain Node against pure modules and the Hono app with
// in-memory dependencies, so they need neither Cloudflare nor an API key.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
