"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button, Input, Select, Table, TBody, Td, Th, THead, Tr, ZoneBadge, zoneMeta } from "@safuney/ui";
import type { PlannerResult } from "@/lib/planner/actions";
import { plannerLeadAction } from "@/lib/planner/actions";

interface FacilityOption {
  slug: string;
  name: string;
  unitLabel: string;
  unitHint: string;
}

export function PlannerForm({ facilities, action }: { facilities: FacilityOption[]; action: (facility: string, units: string) => Promise<PlannerResult> }) {
  const [facility, setFacility] = useState(facilities[0]?.slug ?? "");
  const [units, setUnits] = useState("");
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [pending, start] = useTransition();
  const chosen = facilities.find((f) => f.slug === facility);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [sent, setSent] = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, startSending] = useTransition();

  return (
    <div className="mt-8">
      <form
        className="flex max-w-reading flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(null);
          start(async () => setResult(await action(facility, units)));
        }}
      >
        <Select label="What do you run?" id="facility" value={facility} onChange={(e) => setFacility(e.target.value)} fieldClassName="flex-1">
          {facilities.map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.name}
            </option>
          ))}
        </Select>
        <Input
          label={chosen?.unitLabel ?? "Size"}
          id="units"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          inputMode="numeric"
          helper={chosen?.unitHint}
          fieldClassName="flex-1"
        />
        <Button type="submit" variant="primary" busy={pending} busyLabel="Working…" className="sm:mb-1">
          Plan it
        </Button>
      </form>

      {result && !result.ok ? (
        <Alert variant="error" className="mt-5 max-w-reading">
          {result.message}
        </Alert>
      ) : null}

      {result?.ok ? (
        <div className="mt-10">
          <h2 className="text-h2">
            {result.plan.facility.name}, {result.plan.units} {result.plan.facility.unitLabel.toLowerCase()}
          </h2>

          <section className="mt-6">
            <h3 className="text-h3">What you would get through in a month</h3>
            <div className="mt-3">
              <Table caption="Estimated monthly consumption by task">
                <THead>
                  <Tr>
                    <Th>Task</Th>
                    <Th>How often</Th>
                    <Th>Solution</Th>
                    <Th>Concentrate</Th>
                  </Tr>
                </THead>
                <TBody>
                  {result.plan.tasks.map((t) => (
                    <Tr key={t.key}>
                      <Td>
                        {t.label}
                        <span className="mt-1 block">
                          <ZoneBadge zone={t.zone} />
                        </span>
                      </Td>
                      <Td>{t.frequencyLabel}</Td>
                      <Td className="whitespace-nowrap tabular-nums">{t.solutionLitres} L</Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {t.concentrateLitres} L
                        {t.ratio > 1 ? <span className="mt-1 block font-mono text-caption text-ink-muted">at 1:{t.ratio}</span> : <span className="mt-1 block text-caption text-ink-muted">used neat</span>}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            <p className="mt-3 text-body text-ink">
              About <span className="font-medium tabular-nums">{result.plan.totalConcentrateLitres} L</span> of concentrate
              a month in total, dosed correctly.
            </p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {[...new Set(result.plan.tasks.map((t) => t.category))].map((c) => (
                <li key={c}>
                  <Link href={`/products/${c}`} className="text-body text-accent underline">
                    Shop {c.replace(/-/g, " ")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="text-h3">The kit this needs</h3>
            <p className="mt-2 max-w-reading text-body text-ink-muted">
              One set of cloths, mops, buckets and gloves per zone, stored separately. This is the part sites get
              wrong, and it is cheaper than the chemicals.
            </p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {result.plan.zones.map((z) => {
                const meta = zoneMeta(z)!;
                return (
                  <li key={z} className="border border-line bg-surface p-4">
                    <ZoneBadge zone={z} />
                    <p className="mt-2 text-body text-ink">{meta.meaning}</p>
                    <p className="mt-2 text-caption text-ink-muted">Cloths, mop and bucket, gloves — in this colour, stored apart from the others.</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-10">
            <h3 className="text-h3">Cleaning schedule</h3>
            <p className="mt-2 max-w-reading text-body text-ink-muted">Print this and put it where the cleaning store is.</p>
            <div className="mt-3">
              <Table caption="Cleaning schedule">
                <THead>
                  <Tr>
                    <Th>Task</Th>
                    <Th>Zone</Th>
                    <Th>How often</Th>
                    <Th>Dilution</Th>
                    <Th>Done by</Th>
                  </Tr>
                </THead>
                <TBody>
                  {result.plan.tasks.map((t) => (
                    <Tr key={t.key}>
                      <Td>{t.label}</Td>
                      <Td>{zoneMeta(t.zone)!.label}</Td>
                      <Td>{t.frequencyLabel}</Td>
                      <Td className="font-mono">{t.ratio > 1 ? `1:${t.ratio}` : "neat"}</Td>
                      <Td className="text-ink-muted">&nbsp;</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            <p className="mt-3 text-caption text-ink-muted">
              The last column is left empty on purpose — it is signed on the day, by the person who did it.
            </p>
          </section>

          <section className="mt-10 max-w-reading border border-line bg-surface p-5">
            <h3 className="text-h3">Want this priced?</h3>
            <p className="mt-2 text-body text-ink-muted">
              Send us the plan and we will come back with an order sheet: the right pack sizes for these volumes,
              at your price.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                startSending(async () => setSent(await plannerLeadAction(result.plan.facility.slug, result.plan.units, { name, email, phone, organisation })));
              }}
            >
              <Input label="Your name" id="planner-name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Organisation" id="planner-org" value={organisation} onChange={(e) => setOrganisation(e.target.value)} optional />
              <Input label="Email" id="planner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} optional />
              <Input label="Phone" id="planner-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} optional helper="An email address or a phone number — either is enough." />
              {sent ? <Alert variant={sent.ok ? "success" : "error"}>{sent.message}</Alert> : null}
              <Button type="submit" variant="primary" busy={sending} busyLabel="Sending…">
                Send me a priced order sheet
              </Button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
