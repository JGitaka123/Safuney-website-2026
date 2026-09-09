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

export function StaffManager({ staff, create, setRole }: { staff: Staff[]; create: (email: string, name: string, role: string, password: string) => Promise<AdminResult>; setRole: (id: string, role: string, active: boolean) => Promise<AdminResult> }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setNewRole] = useState("SALES");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<{ email: string; uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowResult, setRowResult] = useState<Record<string, string>>({});
  const [rowPending, startRow] = useTransition();

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
                    <StaffRow staff={s} setRole={setRole} pending={rowPending} start={startRow} result={rowResult[s.id]} onResult={(m) => setRowResult((r) => ({ ...r, [s.id]: m }))} />
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

function StaffRow({ staff, setRole, pending, start, result, onResult }: { staff: Staff; setRole: (id: string, role: string, active: boolean) => Promise<AdminResult>; pending: boolean; start: (fn: () => void) => void; result?: string; onResult: (message: string) => void }) {
  const [role, setNext] = useState(staff.role);
  const [active, setActive] = useState(staff.isActive);
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
      {result ? (
        <p role="status" className="text-caption text-ink-muted">
          {result}
        </p>
      ) : null}
    </div>
  );
}
