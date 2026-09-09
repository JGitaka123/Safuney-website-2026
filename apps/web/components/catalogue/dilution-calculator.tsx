"use client";

import { useId, useState } from "react";
import { calculate, litresPerPack, ratioLabel, type DilutionRow } from "@/lib/catalogue/dilution";

interface Props {
  rows: DilutionRow[];
  /** Pack sizes in litres (or kilograms for powders), used for the "one pack makes" line. */
  packs: Array<{ label: string; litres: number }>;
}

/** Litres of solution needed → product to measure out (plan §4.7, brief Phase 2). */
export function DilutionCalculator({ rows, packs }: Props) {
  const id = useId();
  const [rowIndex, setRowIndex] = useState(0);
  const [litres, setLitres] = useState(10);
  const row = rows[rowIndex] ?? rows[0];
  if (!row) return null;
  const result = calculate(litres, row.ratio);
  const productLabel = result.productMl >= 1000 ? `${(result.productMl / 1000).toFixed(2).replace(/\.?0+$/, "")} L` : `${result.productMl} ml`;
  const waterLabel = result.waterMl >= 1000 ? `${(result.waterMl / 1000).toFixed(2).replace(/\.?0+$/, "")} L` : `${result.waterMl} ml`;

  return (
    <div className="border border-line bg-surface p-5">
      <h3 className="text-h4">Dilution calculator</h3>
      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <label htmlFor={`${id}-use`} className="flex min-w-0 flex-col gap-1 text-small">
          What are you cleaning?
          <select id={`${id}-use`} value={rowIndex} onChange={(e) => setRowIndex(Number(e.target.value))} className="min-h-12 w-full min-w-0 rounded-chip border border-stainless bg-surface px-3 text-body">
            {rows.map((r, i) => (
              <option key={i} value={i}>
                {r.use} ({ratioLabel(r.ratio)})
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-litres`} className="flex min-w-0 flex-col gap-1 text-small">
          Litres of solution you need
          <input
            id={`${id}-litres`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={litres}
            onChange={(e) => setLitres(Math.max(0, Number(e.target.value) || 0))}
            className="min-h-12 w-full min-w-0 rounded-chip border border-stainless bg-surface px-3 text-body tabular-nums"
          />
        </label>
      </div>
      <dl aria-live="polite" className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div>
          <dt className="text-small text-ink-muted">Product to measure</dt>
          <dd className="tnum text-price-lg">{row.ratio === 0 ? productLabel : productLabel}</dd>
        </div>
        <div>
          <dt className="text-small text-ink-muted">Water</dt>
          <dd className="tnum text-price-lg">{row.ratio === 0 ? "None" : waterLabel}</dd>
        </div>
      </dl>
      {row.contactTimeMinutes ? <p className="mt-3 text-small">Keep the surface wet for {row.contactTimeMinutes} min.</p> : null}
      {row.note ? <p className="mt-1 text-small text-ink-muted">{row.note}</p> : null}
      {row.ratio > 0 && packs.length > 0 ? (
        <p className="mt-3 text-caption text-ink-muted">
          At {ratioLabel(row.ratio)}, {packs.map((p) => `${p.label} makes ${litresPerPack(p.litres, row.ratio).toLocaleString("en-KE")} L`).join("; ")}.
        </p>
      ) : null}
    </div>
  );
}
