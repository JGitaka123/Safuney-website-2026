/**
 * The compliance hub: safety data sheets and certificates of analysis, with version history, and a
 * subscription so a B2B account is told when a sheet is superseded.
 *
 * Version history is the point. A site file holding a sheet that was superseded eighteen months ago
 * looks like a record and is not one, and the person who finds that out is usually an auditor. So the
 * library shows the current version, keeps the chain behind it, and can tell the people who rely on a
 * sheet when it changes.
 */
import { db, type DocumentType } from "@safuney/db";
import { services } from "@/lib/env";

export interface LibraryDocument {
  id: string;
  type: DocumentType;
  title: string;
  version: string;
  fileUrl: string;
  publishedAt: Date;
  sizeBytes: number | null;
  products: Array<{ name: string; href: string }>;
  /** Older versions, newest first. */
  history: Array<{ id: string; version: string; publishedAt: Date; fileUrl: string }>;
  subscribed: boolean;
}

/** Walks the `supersedes` chain backwards from a current document. */
async function historyOf(documentId: string): Promise<LibraryDocument["history"]> {
  const chain: LibraryDocument["history"] = [];
  let cursor: string | null = documentId;
  // Bounded: a malformed chain must not spin here.
  for (let i = 0; i < 20 && cursor; i++) {
    const doc: { supersedesId: string | null; supersedes: { id: string; version: string; publishedAt: Date; fileUrl: string } | null } | null = await db().document.findUnique({
      where: { id: cursor },
      select: { supersedesId: true, supersedes: { select: { id: true, version: true, publishedAt: true, fileUrl: true } } },
    });
    if (!doc?.supersedes) break;
    chain.push(doc.supersedes);
    cursor = doc.supersedesId;
  }
  return chain;
}

export async function library(customerId: string | null, type?: DocumentType): Promise<LibraryDocument[]> {
  if (!services.database()) return [];
  const documents = await db().document.findMany({
    where: { supersededBy: null, ...(type ? { type } : { type: { in: ["SDS", "COA"] } }) },
    select: {
      id: true,
      type: true,
      title: true,
      version: true,
      fileUrl: true,
      publishedAt: true,
      sizeBytes: true,
      sdsFor: { select: { name: true, slug: true, category: { select: { slug: true } } } },
      coaFor: { select: { name: true, slug: true, category: { select: { slug: true } } } },
      products: { select: { product: { select: { name: true, slug: true, category: { select: { slug: true } } } } } },
    },
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });

  const subscriptions = customerId
    ? new Set((await db().documentSubscription.findMany({ where: { customerId }, select: { documentId: true } })).map((s) => s.documentId))
    : new Set<string>();

  return Promise.all(
    documents.map(async (d) => {
      const linked = [...d.sdsFor, ...d.coaFor, ...d.products.map((p) => p.product)];
      const seen = new Set<string>();
      return {
        id: d.id,
        type: d.type,
        title: d.title,
        version: d.version,
        fileUrl: d.fileUrl,
        publishedAt: d.publishedAt,
        sizeBytes: d.sizeBytes,
        products: linked
          .filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)))
          .map((p) => ({ name: p.name, href: `/products/${p.category.slug}/${p.slug}` })),
        history: await historyOf(d.id),
        subscribed: subscriptions.has(d.id),
      };
    }),
  );
}

export class ComplianceError extends Error {}

/** A B2B account asking to be told when a sheet changes. Idempotent: asking twice is asking once. */
export async function subscribe(customerId: string, documentId: string): Promise<void> {
  const document = await db().document.findUnique({ where: { id: documentId }, select: { supersededBy: { select: { id: true } } } });
  if (!document) throw new ComplianceError("That document no longer exists.");
  if (document.supersededBy) throw new ComplianceError("That version has already been replaced. Subscribe to the current one.");
  await db().documentSubscription.upsert({
    where: { customerId_documentId: { customerId, documentId } },
    create: { customerId, documentId },
    update: {},
  });
}

export async function unsubscribe(customerId: string, documentId: string): Promise<void> {
  await db().documentSubscription.deleteMany({ where: { customerId, documentId } });
}

/**
 * Who to tell that a sheet has been superseded.
 *
 * Returns the subscribers of the **old** document — the people holding the version that just stopped
 * being current. Notifying subscribers of the new one would reach nobody, since it has just been
 * created.
 */
export async function subscribersToNotify(supersededDocumentId: string): Promise<Array<{ customerId: string; displayName: string; emails: string[] }>> {
  const subscriptions = await db().documentSubscription.findMany({
    where: { documentId: supersededDocumentId },
    select: { customer: { select: { id: true, displayName: true, members: { select: { user: { select: { email: true } } } } } } },
  });
  return subscriptions.map((s) => ({
    customerId: s.customer.id,
    displayName: s.customer.displayName,
    emails: s.customer.members.map((m) => m.user.email).filter((e): e is string => Boolean(e)),
  }));
}
