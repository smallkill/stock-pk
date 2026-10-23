import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: { VISIT_SALT: "test-salt" },
        // mock devbox service binding,讓 miniflare 啟動(測試不實際呼叫它)。
        serviceBindings: {
          DEVBOX: () =>
            new Response(JSON.stringify({ shortUrl: "https://devbox-api.test/abc" }), {
              status: 201,
              headers: { "content-type": "application/json" },
            }),
        },
      },
    }),
  ],
});
