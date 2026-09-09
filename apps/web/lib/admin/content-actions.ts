"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { adminAction, AdminError, type AdminResult } from "./action";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const saveContentPage = adminAction(
  "content.page.save",
  "content.write",
  "ContentPage",
  async (ctx, slug: string, locale: string, title: string, body: string, published: boolean): Promise<AdminResult> => {
    const key = slug.trim().toLowerCase();
    if (!SLUG.test(key)) throw new AdminError("The address may only contain lowercase letters, numbers and hyphens, for example safety-data-sheets.");
    if (!title.trim()) throw new AdminError("Give the page a title; it is what search results show.");
    if (!body.trim()) throw new AdminError("The page has no content.");
    const loc = locale === "sw" ? "sw" : "en";

    const before = await db().contentPage.findUnique({ where: { slug_locale: { slug: key, locale: loc } }, select: { title: true, isPublished: true, body: true } });
    const page = await db().contentPage.upsert({
      where: { slug_locale: { slug: key, locale: loc } },
      create: { slug: key, locale: loc, title: title.trim(), body, isPublished: published },
      update: { title: title.trim(), body, isPublished: published },
      select: { id: true },
    });
    ctx.audit({
      entity: "ContentPage",
      entityId: page.id,
      // The body itself is not copied into the audit row: pages run to thousands of words and the
      // log is for who changed what, not for storing a second copy of the site.
      before: before ? { title: before.title, isPublished: before.isPublished, bodyLength: before.body.length } : undefined,
      after: { slug: key, locale: loc, title: title.trim(), isPublished: published, bodyLength: body.length },
    });
    revalidatePath(`/${key}`);
    revalidatePath("/admin/content");
    return { ok: true, message: published ? "Published." : "Saved as a draft.", id: page.id };
  },
);

/** A review is invisible until someone reads it; nothing a customer writes goes live unmoderated. */
export const moderateReview = adminAction(
  "reviews.moderate",
  "reviews.moderate",
  "Review",
  async (ctx, reviewId: string, approve: boolean): Promise<AdminResult> => {
    const before = await db().review.findUnique({ where: { id: reviewId }, select: { isApproved: true, productId: true, product: { select: { slug: true } } } });
    if (!before) throw new AdminError("That review no longer exists.");
    await db().review.update({ where: { id: reviewId }, data: { isApproved: approve } });
    ctx.audit({ entity: "Review", entityId: reviewId, before: { isApproved: before.isApproved }, after: { isApproved: approve } });
    revalidatePath(`/products/${before.product.slug}`);
    revalidatePath("/admin/content");
    return { ok: true, message: approve ? "Published." : "Hidden.", id: reviewId };
  },
);

/** Deletes a review outright — for abuse and spam, where hiding is not enough. */
export const deleteReview = adminAction(
  "reviews.delete",
  "reviews.moderate",
  "Review",
  async (ctx, reviewId: string): Promise<AdminResult> => {
    const before = await db().review.findUnique({ where: { id: reviewId }, select: { rating: true, title: true, body: true, productId: true } });
    if (!before) throw new AdminError("That review no longer exists.");
    await db().review.delete({ where: { id: reviewId } });
    ctx.audit({ entity: "Review", entityId: reviewId, before: { rating: before.rating, title: before.title, body: before.body.slice(0, 200) }, after: { deleted: true } });
    revalidatePath("/admin/content");
    return { ok: true, message: "Removed.", id: reviewId };
  },
);
