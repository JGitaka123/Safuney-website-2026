import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // With a database, every file shares one Postgres and many of them change products and stock, so
    // run the files one at a time: in parallel, the catalogue round trip saw another file's edit land
    // between its export and its import. Without a database those files skip and order does not matter.
    fileParallelism: !process.env["DATABASE_URL"],
  },
});
