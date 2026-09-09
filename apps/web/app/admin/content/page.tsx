import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";
import { PageEditor } from "@/components/admin/page-editor";
import { ReviewQueue } from "@/components/admin/review-queue";
import { deleteReview, moderateReview, saveContentPage } from "@/lib/admin/content-actions";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage() {
  const who = await viewer();
  if (!who || !can(who.role, "content.write")) redirect("/account?denied=1");
  const [pages, reviews] = await Promise.all([
    db().contentPage.findMany({ orderBy: [{ slug: "asc" }, { locale: "asc" }], select: { id: true, slug: true, locale: true, title: true, body: true, isPublished: true, updatedAt: true } }),
    can(who.role, "reviews.moderate")
      ? db().review.findMany({
          where: { isApproved: false },
          orderBy: { createdAt: "asc" },
          take: 50,
          select: { id: true, rating: true, title: true, body: true, createdAt: true, verifiedOrderId: true, product: { select: { name: true } }, user: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="text-h1">Content</h1>

      <section className="mt-6">
        <h2 className="text-h3">Pages</h2>
        <p className="mt-2 max-w-reading text-body text-ink-muted">
          Editable pages live at their own address, for example <span className="font-mono">/safety-data-sheets</span>. A
          draft is invisible to customers until you publish it.
        </p>
        <PageEditor
          pages={pages.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString().slice(0, 10) }))}
          save={saveContentPage}
        />
      </section>

      {can(who.role, "reviews.moderate") && (
        <section className="mt-10">
          <h2 className="text-h3">Reviews waiting</h2>
          <p className="mt-2 max-w-reading text-body text-ink-muted">
            Nothing a customer writes appears on a product until someone here reads it. A review marked verified came
            from an account with a delivered order containing that product.
          </p>
          <ReviewQueue
            reviews={reviews.map((r) => ({
              id: r.id,
              rating: r.rating,
              title: r.title,
              body: r.body,
              product: r.product.name,
              who: r.user.name ?? r.user.email ?? "Customer",
              verified: r.verifiedOrderId !== null,
              when: r.createdAt.toISOString().slice(0, 10),
            }))}
            approve={moderateReview}
            remove={deleteReview}
          />
        </section>
      )}
    </div>
  );
}
