"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Select, Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

interface Staff {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  hasTotp: boolean;
  isSelf: boolean;
}

const ROLES = [
  { value: "SALES", label: "Sales" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "FINANCE", label: "Finance" },
  { value: "ADMIN", label: "Administrator" },
];

type Reset = (id: string) => Promise<AdminResult>;
interface Revealed {
  email: string;
  password: string;
  key: string;
  uri: string;
}

export function StaffManager({ staff, create, setRole, reset }: { staff: Staff[]; create: (email: string, name: string, role: string, password: string) => Promise<AdminResult>; setRole: (id: string, role: string, active: boolean) => Promise<AdminResult>; reset: Reset }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setNewRole] = useState("SALES");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<{ email: string; uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowResult, setRowResult] = useState<Record<string, string>>({});
  const [rowPending, startRow] = useTransition();
  // New sign-in details from a reset. Held in this page only: gone on reload, never stored.
  const [revealed, setRevealed] = useState<Revealed | null>(null);

  return (
    <div>
      <section className="mt-6 max-w-reading border border-line bg-surface p-5">
        <h2 className="text-h3">Add someone</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await create(email, name, role, password);
              if (r.ok) {
                // The action returns the authenticator URI as its message: it exists only here.
                setCreated({ email, uri: r.message ?? "" });
                setError(null);
                setEmail("");
                setName("");
                setPassword("");
              } else {
                setError(r.message);
                setCreated(null);
              }
            });
          }}
        >
          <Input label="Email" id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Name" id="staff-name" value={name} onChange={(e) => setName(e.target.value)} optional />
          <Select label="Role" id="staff-role" value={role} onChange={(e) => setNewRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Input label="First password" id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} helper="At least 12 characters. Tell them to change it after the first sign-in." />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button type="submit" variant="primary" busy={pending} busyLabel="Creating…">
            Create account
          </Button>
        </form>

        {created ? (
          <Alert variant="success" className="mt-4">
            <p>
              {created.email} is set up. Have them add this to their authenticator app now — it will not be shown
              again.
            </p>
            <p className="mt-2 break-all font-mono text-caption">{created.uri}</p>
          </Alert>
        ) : null}
      </section>

      {revealed ? <ResetDetails details={revealed} onDone={() => setRevealed(null)} /> : null}

      <div className="mt-8">
        <Table caption="Staff accounts and their roles">
          <THead>
            <Tr>
              <Th>Who</Th>
              <Th>Role</Th>
              <Th>Authenticator</Th>
              <Th>Change</Th>
            </Tr>
          </THead>
          <TBody>
            {staff.map((s) => (
              <Tr key={s.id}>
                <Td>
                  {s.name ?? "—"}
                  <span className="mt-1 block text-caption text-ink-muted">{s.email}</span>
                </Td>
                <Td>
                  {s.role.toLowerCase()}
                  {s.isActive ? "" : " · switched off"}
                </Td>
                <Td>{s.hasTotp ? "Set up" : "Not set up"}</Td>
                <Td>
                  {s.isSelf ? (
                    <span className="text-caption text-ink-muted">This is you</span>
                  ) : (
                    <StaffRow staff={s} setRole={setRole} reset={reset} onRevealed={setRevealed} pending={rowPending} start={startRow} result={rowResult[s.id]} onResult={(m) => setRowResult((r) => ({ ...r, [s.id]: m }))} />
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function ResetDetails({ details, onDone }: { details: Revealed; onDone: () => void }) {
  return (
    <section className="mt-6 max-w-reading" aria-live="polite">
      <Alert variant="success">
        <p className="font-medium">New sign-in details for {details.email}. They are shown once: write them down or save them in the password manager now.</p>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="text-caption text-ink-muted">Password</dt>
            <dd className="break-all font-mono">{details.password}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Authenticator setup key (time based)</dt>
            <dd className="break-all font-mono">{details.key}</dd>
          </div>
        </dl>
        <p className="mt-3 text-caption">
          Give them to the person directly, not by email or chat. In their authenticator app they delete the old Safuney entry,
          choose <em>Enter a setup key</em>, type their email as the name and the key above, with <em>Time based</em> selected.
          They then sign in at /sign-in/staff and should change the password on the Security page.
        </p>
        <details className="mt-2 text-caption">
          <summary className="cursor-pointer">Setup link, for apps that take one</summary>
          <p className="mt-1 break-all font-mono">{details.uri}</p>
        </details>
        <Button className="mt-3" variant="secondary" size="sm" onClick={onDone}>
          Done, hide these
        </Button>
      </Alert>
    </section>
  );
}

function StaffRow({ staff, setRole, reset, onRevealed, pending, start, result, onResult }: { staff: Staff; setRole: (id: string, role: string, active: boolean) => Promise<AdminResult>; reset: Reset; onRevealed: (d: Revealed) => void; pending: boolean; start: (fn: () => void) => void; result?: string; onResult: (message: string) => void }) {
  const [role, setNext] = useState(staff.role);
  const [active, setActive] = useState(staff.isActive);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      <Select label="Role" fieldClassName="gap-1" id={`role-${staff.id}`} value={role} onChange={(e) => setNext(e.target.value)}>
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
        <option value="CUSTOMER">No staff access</option>
      </Select>
      <label className="flex items-center gap-2 text-caption text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" />
        Can sign in
      </label>
      <Button variant="secondary" size="sm" busy={pending} busyLabel="Saving…" onClick={() => start(async () => onResult((await setRole(staff.id, role, active)).message ?? ""))}>
        Save
      </Button>
      {confirming ? (
        <div className="space-y-2 border border-line p-2">
          <p className="text-caption text-ink">
            Give {staff.email} a new password and authenticator key? Their current ones stop working and they are signed out on every device.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              busy={pending}
              busyLabel="Resetting…"
              onClick={() =>
                start(async () => {
                  const r = await reset(staff.id);
                  setConfirming(false);
                  onResult(r.message ?? "");
                  if (r.ok && r.reveal) onRevealed({ email: r.reveal["email"] ?? staff.email, password: r.reveal["password"] ?? "", key: r.reveal["key"] ?? "", uri: r.reveal["uri"] ?? "" });
                })
              }
            >
              Yes, reset
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          Reset sign-in
        </Button>
      )}
      {result ? (
        <p role="status" className="text-caption text-ink-muted">
          {result}
        </p>
      ) : null}
    </div>
  );
}
