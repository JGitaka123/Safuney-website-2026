import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Integration tests need DATABASE_URL; they skip themselves when it is not set.
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
