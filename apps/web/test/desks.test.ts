/** The staff desk menu and sign-in landing follow the roles each desk's page admits. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DESKS, desksFor, homeDesk } from "@/lib/auth/desks";

describe("staff desks", () => {
  it("lands every role on a desk it can open", () => {
    for (const role of ["WAREHOUSE", "SALES", "FINANCE", "ADMIN"] as const) expect(desksFor(role).map((d) => d.href)).toContain(homeDesk(role));
    expect(homeDesk("WAREHOUSE")).toBe("/warehouse");
    expect(homeDesk("SALES")).toBe("/sales");
    expect(homeDesk("FINANCE")).toBe("/admin");
    expect(homeDesk("ADMIN")).toBe("/admin");
    expect(homeDesk("CUSTOMER")).toBe("/account");
  });

  it("shows customers no desks", () => {
    expect(desksFor("CUSTOMER")).toEqual([]);
    expect(desksFor("B2B_BUYER")).toEqual([]);
  });

  it("lists each desk with exactly the roles its page admits", () => {
    // The menu must never offer a desk that turns the person away: read each page's requireRole call.
    const pages: Record<string, string> = { "/warehouse": "app/warehouse/page.tsx", "/sales": "app/sales/page.tsx", "/sales/credit": "app/sales/credit/page.tsx" };
    for (const desk of DESKS.filter((d) => pages[d.href])) {
      const source = readFileSync(resolve(__dirname, "..", pages[desk.href]!), "utf8");
      const roles = /requireRole\(\[([^\]]*)\]/.exec(source)?.[1]?.match(/"([A-Z_]+)"/g)?.map((r) => r.slice(1, -1)) ?? [];
      expect([...desk.roles].sort(), desk.href).toEqual(roles.sort());
    }
  });
});
