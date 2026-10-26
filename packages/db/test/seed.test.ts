import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/seed";

describe("catalogue CSV parser", () => {
  it("handles quoted commas and escaped quotes", () => {
    const rows = parseCsv('a,b,c\n1,"x, y","he said ""hi"""\n');
    expect(rows).toEqual([{ a: "1", b: "x, y", c: 'he said "hi"' }]);
  });
  it("tolerates CRLF and blank lines", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ a: "3", b: "4" });
  });
});

const url = process.env["DATABASE_URL"];
const withDb = url ? describe : describe.skip;

withDb("demo seed", () => {
  it("refuses a database that holds a real staff account", async () => {
    const { createTestClient } = await import("../src/index");
    const { seedDemo } = await import("../src/seed");
    const prisma = createTestClient(url!);
    const email = `real-admin-${Date.now().toString(36)}@safuney.com`;
    const user = await prisma.user.create({ data: { email, role: "ADMIN" } });
    try {
      await expect(seedDemo(prisma)).rejects.toThrow(/real staff accounts/);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.$disconnect();
    }
  });
});
