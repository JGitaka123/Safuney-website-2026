"use server";

import { revalidatePath } from "next/cache";
import { orderService } from "@/lib/orders/context";
import { getCurrentSession } from "@/lib/auth/session";

export async function approveOrderAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.memberRole !== "APPROVER" && session.memberRole !== "OWNER")) {
    throw new Error("Only authorised corporate approvers can approve orders.");
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) throw new Error("Order ID required.");

  await orderService().approveOrder(orderId, session.user.id);
  revalidatePath("/account");
}

export async function rejectOrderAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || (session.memberRole !== "APPROVER" && session.memberRole !== "OWNER")) {
    throw new Error("Only authorised corporate approvers can reject orders.");
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!orderId) throw new Error("Order ID required.");

  await orderService().rejectOrder(orderId, session.user.id, reason || undefined);
  revalidatePath("/account");
}
