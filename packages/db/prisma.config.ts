import { defineConfig } from "prisma/config";

// DATABASE_URL is injected by Vercel (Neon integration) in deployed environments and by
// apps/web/.env.local (pulled with `vercel env pull`) or the shell locally. Never commit it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@127.0.0.1:5432/safuney_dev",
  },
});
