import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"
import { readFileSync } from "fs"

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: "./wrangler.toml" },
    miniflare: {
      bindings: {
        // Schema SQL passed as a binding so the Workers runtime can exec it in beforeAll
        DB_SCHEMA: readFileSync("./schema.sql", "utf-8"),
        // Fake Spotify credentials so the import route doesn't return 503
        SPOTIFY_CLIENT_ID: "test-spotify-id",
        SPOTIFY_CLIENT_SECRET: "test-spotify-secret",
        ODESLI_API_KEY: "",
      },
    },
  })],
  test: {
    include: ["src/integration/**/*.test.ts"],
  },
})
