"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { requireViewer } from "@/lib/auth/session";
import { AddressError, AddressService, type AddressInput } from "./addresses";
import type { ActionResult } from "@/lib/b2b/actions";

function addresses(): AddressService {
  return new AddressService(db());
}

function fail(e: unknown): ActionResult {
  if (e instanceof AddressError) return { ok: false, message: e.message };
  console.error("address action failed", e);
  return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
}

function fromForm(formData: FormData): AddressInput {
  return {
    label: String(formData.get("label") ?? ""),
    recipientName: String(formData.get("recipientName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    county: String(formData.get("county") ?? ""),
    town: String(formData.get("town") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    landmark: String(formData.get("landmark") ?? ""),
    deliveryNotes: String(formData.get("deliveryNotes") ?? ""),
    isDefault: formData.get("isDefault") === "on",
  };
}

export async function createAddressAction(formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/addresses");
  try {
    await addresses().create(who.id, fromForm(formData));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function updateAddressAction(id: string, formData: FormData): Promise<ActionResult> {
  const who = await requireViewer("/account/addresses");
  try {
    await addresses().update(who.id, id, fromForm(formData));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address updated." };
}

export async function setDefaultAddressAction(id: string): Promise<ActionResult> {
  const who = await requireViewer("/account/addresses");
  try {
    await addresses().setDefault(who.id, id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  const who = await requireViewer("/account/addresses");
  try {
    await addresses().remove(who.id, id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address removed." };
}
