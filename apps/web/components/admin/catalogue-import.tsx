"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";
import type { ImportPlan } from "@/lib/admin/catalogue-csv";

/**
 * Upload, read the diff, then apply. The diff is the point: the PO is correcting a live catalogue and
 * needs to see that a decimal did not slip before prices change under customers.
 *
 * The file is read in the browser and sent as text, so the server never handles a multipart body it
 * would have to buffer twice.
 */
export function CatalogueImport({ preview, apply }: { preview: (csv: string) => Promise<ImportPlan | { error: string }>; apply: (csv: string) => Promise<AdminResult> }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AdminResult | null>(null);
  const [reading, startReading] = useTransition();
  const [applying, startApplying] = useTransition();

  function onFile(file: File) {
    setPlan(null);
    setDone(null);
    setError(null);
    setFileName(file.name);
    void file.text().then((text) => {
      setCsv(text);
      startReading(async () => {
        const result = await preview(text);
        if ("error" in result) { setError(result.error); return; }
        setPlan(result);
      });
    });
  }

  const blocking = plan ? plan.counts.error > 0 : false;
  const shown = plan?.rows.filter((r) => r.kind !== "unchanged").slice(0, 200) ?? [];

  return (
    <div className="mt-6">
      <label className="block text-caption text-ink-muted" htmlFor="catalogue-csv">
        Choose the edited CSV
      </label>
      <input
        id="catalogue-csv"
        type="file"
        accept=".csv,text/csv"
        className="mt-1 block text-body text-ink file:mr-3 file:min-h-11 file:border file:border-stainless file:bg-surface file:px-4 file:text-body file:text-ink"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {fileName ? <p className="mt-2 text-caption text-ink-muted">{fileName}</p> : null}
      {reading ? <p className="mt-3 text-body text-ink-muted">Reading…</p> : null}
      {error ? (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {done ? (
        <Alert variant={done.ok ? "success" : "error"} className="mt-4">
          {done.message}
        </Alert>
      ) : null}

      {plan && !done ? (
        <div className="mt-6">
          <h2 className="text-h3">What would change</h2>
          <ul className="mt-2 flex flex-wrap gap-4 text-body">
            <li>
              <span className="tabular-nums text-ink">{plan.counts.new}</span> <span className="text-ink-muted">new</span>
            </li>
            <li>
              <span className="tabular-nums text-ink">{plan.counts.changed}</span> <span className="text-ink-muted">changed</span>
            </li>
            <li>
              <span className="tabular-nums text-ink">{plan.counts.unchanged}</span> <span className="text-ink-muted">unchanged</span>
            </li>
            <li>
              <span className="tabular-nums text-ink">{plan.counts.error}</span> <span className="text-ink-muted">with a problem</span>
            </li>
          </ul>

          {blocking ? (
            <Alert variant="warning" className="mt-4">
              Nothing will be imported while any row has a problem. Fix the lines below in your spreadsheet and upload it
              again.
            </Alert>
          ) : null}

          {shown.length > 0 ? (
            <div className="mt-4">
              <Table caption="Rows that would change">
                <THead>
                  <Tr>
                    <Th>Line</Th>
                    <Th>SKU</Th>
                    <Th>Row</Th>
                    <Th>Detail</Th>
                  </Tr>
                </THead>
                <TBody>
                  {shown.map((r) => (
                    <Tr key={r.line}>
                      <Td className="tabular-nums">{r.line}</Td>
                      <Td className="font-mono text-caption">{r.sku || "—"}</Td>
                      <Td>{r.kind === "error" ? "Problem" : r.kind === "new" ? "New" : "Changed"}</Td>
                      <Td>
                        {r.error ? (
                          <span className="text-ink">{r.error}</span>
                        ) : r.kind === "new" ? (
                          <span className="text-ink-muted">{r.productName}</span>
                        ) : (
                          <ul className="space-y-1">
                            {r.changes.map((c) => (
                              <li key={c.field} className="text-caption">
                                <span className="font-mono text-ink-muted">{c.field}</span>{" "}
                                <span className="text-ink-muted line-through">{c.from || "—"}</span> →{" "}
                                <span className="text-ink">{c.to || "—"}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              {(plan.counts.new + plan.counts.changed + plan.counts.error) > shown.length ? (
                <p className="mt-2 text-caption text-ink-muted">Showing the first {shown.length} rows that would change.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-body text-ink-muted">Nothing in this file differs from what is already stored.</p>
          )}

          <Button
            className="mt-6"
            variant="primary"
            busy={applying}
            busyLabel="Importing…"
            disabled={blocking || plan.counts.new + plan.counts.changed === 0}
            onClick={() =>
              startApplying(async () => {
                if (!csv) return;
                const r = await apply(csv);
                setDone(r);
                if (r.ok) setPlan(null);
              })
            }
          >
            Import {plan.counts.new + plan.counts.changed} {plan.counts.new + plan.counts.changed === 1 ? "row" : "rows"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
