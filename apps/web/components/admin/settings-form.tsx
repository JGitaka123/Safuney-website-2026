"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Select } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

export function SettingsForm({
  displayMode: initialMode,
  minimumKes: initialMinimum,
  kraPin: initialPin,
  vatNumber: initialVat,
  save,
}: {
  displayMode: string;
  minimumKes: string;
  kraPin: string;
  vatNumber: string;
  save: (displayMode: string, minimumKes: string, kraPin: string, vatNumber: string) => Promise<AdminResult>;
}) {
  const [mode, setMode] = useState(initialMode);
  const [minimum, setMinimum] = useState(initialMinimum);
  const [pin, setPin] = useState(initialPin);
  const [vat, setVat] = useState(initialVat);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);

  return (
    <form
      className="mt-6 max-w-reading space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await save(mode, minimum, pin, vat)));
      }}
    >
      <Select label="Show prices" id="display-mode" value={mode} onChange={(e) => setMode(e.target.value)} helper="Business customers usually want prices without VAT; the other total is always shown alongside.">
        <option value="EX_VAT">Excluding VAT</option>
        <option value="INC_VAT">Including VAT</option>
      </Select>
      <Input label="Minimum order (KES)" id="minimum" value={minimum} onChange={(e) => setMinimum(e.target.value)} inputMode="decimal" optional helper="Leave empty for no minimum." />
      <Input label="Company KRA PIN" id="kra-pin" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="P051234567X" helper="Printed on every tax invoice." optional />
      <Input label="VAT number" id="vat-number" value={vat} onChange={(e) => setVat(e.target.value)} optional />
      {result ? <Alert variant={result.ok ? "success" : "error"}>{result.message}</Alert> : null}
      <Button type="submit" variant="primary" busy={pending} busyLabel="Saving…">
        Save settings
      </Button>
    </form>
  );
}
