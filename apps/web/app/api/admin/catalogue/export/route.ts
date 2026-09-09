import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { exportCatalogue } from "@/lib/admin/catalogue-csv";

export const dynamic = "force-dynamic";

/** The catalogue as the import expects it back. Staff only — prices and stock are not public. */
export async function GET(): Promise<Response> {
  const who = await viewer();
  if (!who || !can(who.role, "catalogue.write")) return new Response("Not found", { status: 404 });
  const csv = await exportCatalogue();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="safuney-catalogue-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
