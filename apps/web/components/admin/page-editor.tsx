"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Select, Textarea } from "@safuney/ui";
import type { AdminResult } from "@/lib/admin/action";

interface Page {
  id: string;
  slug: string;
  locale: string;
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
}

const NEW = "__new__";

/** One editor for every page: pick an existing one to edit, or write a new one. */
export function PageEditor({ pages, save }: { pages: Page[]; save: (slug: string, locale: string, title: string, body: string, published: boolean) => Promise<AdminResult> }) {
  const [selected, setSelected] = useState(NEW);
  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState("en");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);

  function choose(id: string) {
    setSelected(id);
    setResult(null);
    const page = pages.find((p) => p.id === id);
    setSlug(page?.slug ?? "");
    setLocale(page?.locale ?? "en");
    setTitle(page?.title ?? "");
    setBody(page?.body ?? "");
    setPublished(page?.isPublished ?? false);
  }

  return (
    <form
      className="mt-4 max-w-reading space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await save(slug, locale, title, body, published)));
      }}
    >
      <Select label="Page" id="page-pick" value={selected} onChange={(e) => choose(e.target.value)}>
        <option value={NEW}>Write a new page…</option>
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            /{p.slug} ({p.locale}) — {p.title}
            {p.isPublished ? "" : " · draft"}
          </option>
        ))}
      </Select>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Address" id="page-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="safety-data-sheets" helper="What comes after the slash." />
        <Select label="Language" id="page-locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
          <option value="en">English</option>
          <option value="sw">Kiswahili</option>
        </Select>
      </div>
      <Input label="Title" id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Content" id="page-body" rows={16} value={body} onChange={(e) => setBody(e.target.value)} helper="Markdown: # for a heading, - for a list, **bold**." className="font-mono text-small" />

      <label className="flex items-center gap-2 text-body text-ink">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-5" />
        Visible to customers
      </label>

      {result ? <Alert variant={result.ok ? "success" : "error"}>{result.message}</Alert> : null}
      <Button type="submit" variant="primary" busy={pending} busyLabel="Saving…">
        Save
      </Button>
    </form>
  );
}
