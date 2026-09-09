"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Select, Textarea } from "@safuney/ui";
import type { RepResult } from "@/lib/reps/actions";

type Position = { latitude: number; longitude: number; accuracyM: number } | null;

/**
 * Mobile-first: a rep fills this standing outside a customer's gate, one-handed, on a phone.
 *
 * Location is a deliberate tap, never automatic. The browser would prompt on load if we asked for it
 * then, which trains people to dismiss the prompt and means the one time it matters they say no.
 */
export function VisitForm({ customers, action }: { customers: Array<{ id: string; displayName: string }>; action: (customerId: string, note: string, outcome: string, position: Position) => Promise<RepResult> }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("");
  const [position, setPosition] = useState<Position>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [result, setResult] = useState<RepResult | null>(null);
  const [pending, start] = useTransition();

  function addLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("This device cannot give a location.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy });
        setLocating(false);
      },
      (e) => {
        setLocating(false);
        setLocationError(e.code === e.PERMISSION_DENIED ? "Location was not shared. The visit can still be saved without it." : "Could not get a location just now. Save the visit without it.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return (
    <form
      className="mt-6 max-w-reading space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await action(customerId, note, outcome, position);
          setResult(r);
          if (r.ok) { setNote(""); setOutcome(""); setPosition(null); }
        });
      }}
    >
      <Select label="Customer" id="visit-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.displayName}
          </option>
        ))}
      </Select>
      <Textarea label="What happened" id="visit-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} helper="What they use, what they asked for, what you promised." />
      <Input label="Outcome" id="visit-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} optional placeholder="Quote to follow, sample left, no interest…" />

      <div>
        <Button type="button" variant="secondary" size="sm" busy={locating} busyLabel="Locating…" onClick={addLocation} disabled={position !== null}>
          {position ? "Location added" : "Add my location"}
        </Button>
        {position ? (
          <p className="mt-2 text-caption text-ink-muted">
            Accurate to about {Math.round(position.accuracyM)} m.{" "}
            <button type="button" className="text-accent underline" onClick={() => setPosition(null)}>
              Remove
            </button>
          </p>
        ) : (
          <p className="mt-2 text-caption text-ink-muted">Optional. The visit saves fine without it.</p>
        )}
        {locationError ? (
          <p role="alert" className="mt-2 text-caption text-ink">
            {locationError}
          </p>
        ) : null}
      </div>

      {result ? <Alert variant={result.ok ? "success" : "error"}>{result.message}</Alert> : null}
      <Button type="submit" variant="primary" fullWidth busy={pending} busyLabel="Saving…" disabled={note.trim().length === 0}>
        Save visit
      </Button>
    </form>
  );
}
