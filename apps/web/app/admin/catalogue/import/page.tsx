import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { CatalogueImport } from "@/components/admin/catalogue-import";
import { COLUMNS } from "@/lib/admin/catalogue-csv";
import { importCatalogue } from "@/lib/admin/actions";
import { previewImport } from "./preview";

export const metadata: Metadata = { title: "Import catalogue" };

export default async function ImportPage() {
  const who = await viewer();
  if (!who || !can(who.role, "catalogue.write")) redirect("/account?denied=1");
  return (
    <div>
      <h1 className="text-h1">Import catalogue</h1>
      <p className="mt-3 max-w-reading text-body text-ink-muted">
        Export the catalogue, edit it in a spreadsheet, then upload it here. You will see exactly what would change
        before anything is written, and nothing is written unless every row reads cleanly.
      </p>
      <p className="mt-2 max-w-reading text-caption text-ink-muted">
        Columns: <span className="font-mono">{COLUMNS.join(", ")}</span>. A row is matched by its SKU; a SKU that does
        not exist yet creates the variant, and its product too if the slug is new. Reserved stock is never touched.
      </p>
      <ButtonLink href="/api/admin/catalogue/export" variant="secondary" size="sm" className="mt-4">
        Export the current catalogue
      </ButtonLink>
      <CatalogueImport preview={previewImport} apply={importCatalogue} />
    </div>
  );
}
