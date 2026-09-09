"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@safuney/ui";
import type { ComplianceResult } from "@/lib/compliance/actions";

interface DocumentView {
  id: string;
  type: string;
  title: string;
  version: string;
  fileUrl: string;
  publishedAt: string;
  sizeKb: number | null;
  products: Array<{ name: string; href: string }>;
  history: Array<{ id: string; version: string; publishedAt: string; fileUrl: string }>;
  subscribed: boolean;
}

export function DocumentRow({ document, canSubscribe, action }: { document: DocumentView; canSubscribe: boolean; action: (id: string, wanted: boolean) => Promise<ComplianceResult> }) {
  const [subscribed, setSubscribed] = useState(document.subscribed);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showHistory, setShowHistory] = useState(false);

  return (
    <li className="border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-h4">
          <a href={document.fileUrl} className="text-accent underline" target="_blank" rel="noopener noreferrer">
            {document.title}
          </a>
        </h2>
        <span className="text-caption text-ink-muted">
          {document.type} · version {document.version} · {document.publishedAt}
          {document.sizeKb ? ` · ${document.sizeKb} KB` : ""}
        </span>
      </div>

      {document.products.length > 0 ? (
        <p className="mt-2 text-body text-ink-muted">
          For{" "}
          {document.products.map((p, i) => (
            <span key={p.href}>
              {i > 0 ? ", " : ""}
              <Link href={p.href} className="text-accent underline">
                {p.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      {document.history.length > 0 ? (
        <div className="mt-3">
          <button type="button" className="text-caption text-accent underline" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
            {showHistory ? "Hide" : "Show"} {document.history.length} earlier {document.history.length === 1 ? "version" : "versions"}
          </button>
          {showHistory ? (
            <ul className="mt-2 space-y-1">
              {document.history.map((h) => (
                <li key={h.id} className="text-caption text-ink-muted">
                  <a href={h.fileUrl} className="text-accent underline" target="_blank" rel="noopener noreferrer">
                    Version {h.version}
                  </a>{" "}
                  · {h.publishedAt} · superseded
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {canSubscribe ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={subscribed ? "secondary" : "primary"}
            size="sm"
            busy={pending}
            busyLabel="Saving…"
            onClick={() =>
              start(async () => {
                const r = await action(document.id, !subscribed);
                setMessage(r.message);
                if (r.ok) setSubscribed(!subscribed);
              })
            }
          >
            {subscribed ? "Stop telling me" : "Tell me when this changes"}
          </Button>
          {message ? (
            <p role="status" className="text-caption text-ink-muted">
              {message}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-caption text-ink-muted">
          <Link href="/sign-in?next=%2Fcompliance" className="text-accent underline">
            Sign in with an organisation account
          </Link>{" "}
          to be told when this sheet is replaced.
        </p>
      )}
    </li>
  );
}
