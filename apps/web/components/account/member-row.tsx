"use client";

import { useState, useTransition } from "react";
import type { MemberRole } from "@safuney/db";
import { Button } from "@safuney/ui";
import type { ActionResult } from "@/lib/b2b/actions";

interface MemberRowProps {
  customerId: string;
  member: { userId: string; label: string; detail: string; role: MemberRole };
  isSelf: boolean;
  canEdit: boolean;
  setRole: (customerId: string, memberUserId: string, role: MemberRole) => Promise<ActionResult>;
  remove: (customerId: string, memberUserId: string) => Promise<ActionResult>;
}

const LABEL: Record<MemberRole, string> = { OWNER: "Owner", BUYER: "Buyer", APPROVER: "Approver" };

export function MemberRow({ customerId, member, isSelf, canEdit, setRole, remove }: MemberRowProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {member.label}
          {isSelf ? <span className="ml-2 text-small font-normal text-ink-muted">(you)</span> : null}
        </p>
        {member.detail ? <p className="text-small text-ink-muted">{member.detail}</p> : null}
        {error ? (
          <p role="alert" className="text-small text-ink">
            {error}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`role-${member.userId}`}>
            Role of {member.label}
          </label>
          <select
            id={`role-${member.userId}`}
            value={member.role}
            disabled={pending}
            onChange={(e) => {
              setError(null);
              start(async () => {
                const r = await setRole(customerId, member.userId, e.target.value as MemberRole);
                if (!r.ok) setError(r.message);
              });
            }}
            className="min-h-11 rounded-chip border border-stainless bg-surface px-3 text-body text-ink"
          >
            {(Object.keys(LABEL) as MemberRole[]).map((r) => (
              <option key={r} value={r}>
                {LABEL[r]}
              </option>
            ))}
          </select>
          {!isSelf ? (
            <Button
              variant="tertiary"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const r = await remove(customerId, member.userId);
                  if (!r.ok) setError(r.message);
                });
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-small text-ink-muted">{LABEL[member.role]}</p>
      )}
    </li>
  );
}
