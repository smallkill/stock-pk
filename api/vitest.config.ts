import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
export default defineWorkersConfig({
  test: { poolOptions: { workers: {
    isolatedStorage: true,
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
  } } },
});
