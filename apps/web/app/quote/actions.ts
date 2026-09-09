"use server";

import { normaliseKenyanMobile } from "@safuney/config";
import { isDatabaseConfigured } from "@safuney/db";
import { quoteService } from "@/lib/quotes";
import { getCurrentSession } from "@/lib/auth/session";

export interface QuoteFormState {
  ok: boolean | null;
  quoteNumber?: string;
  formError?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export async function submitQuoteAction(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  // Honeypot check
  if (formData.get("website")) {
    return { ok: true, quoteNumber: "SFQ-DEMO-0001" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const organisation = String(formData.get("organisation") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const county = String(formData.get("county") ?? "").trim();
  const town = String(formData.get("town") ?? "").trim();
  const itemsText = String(formData.get("items") ?? "").trim();
  const specialNotes = String(formData.get("notes") ?? "").trim();
  const trialRequested = formData.get("trialRequested") === "on";
  const dosingRequested = formData.get("dosingRequested") === "on";

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors["name"] = "Enter your contact name.";
  if (!email || !email.includes("@")) fieldErrors["email"] = "Enter a valid email address.";
  const phone = normaliseKenyanMobile(rawPhone);
  if (!phone) fieldErrors["phone"] = "Enter a valid Kenyan mobile number (e.g. 07xx xxx xxx or 01xx xxx xxx).";
  if (!county) fieldErrors["county"] = "Select your delivery county.";
  if (!itemsText) fieldErrors["items"] = "List at least one product, pack size, or requirement.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      values: { name, organisation, email, phone: rawPhone, county, town, items: itemsText, notes: specialNotes },
    };
  }

  const session = await getCurrentSession();

  // Parse lines into quote items
  const lines = itemsText.split("\n").map((l) => l.trim()).filter(Boolean);
  const items = lines.map((line) => {
    // Check if line contains a quantity like "5x" or "10 drums"
    const match = line.match(/^(\d+)\s*[xX*]\s*(.+)$/);
    if (match) {
      return {
        qty: parseInt(match[1]!, 10) || 1,
        description: match[2]!.trim(),
      };
    }
    return {
      qty: 1,
      description: line,
    };
  });

  const notesParts = [
    organisation ? `Organisation: ${organisation}` : null,
    `Delivery destination: ${town ? `${town}, ` : ""}${county} County`,
    trialRequested ? "[x] Requesting free 14-day on-site hygiene trial with loaned dispenser" : null,
    dosingRequested ? "[x] Requesting automated dosing station installation quote" : null,
    specialNotes ? `Special requirements: ${specialNotes}` : null,
  ].filter(Boolean);

  const notes = notesParts.join("\n");

  if (!isDatabaseConfigured()) {
    // Demo fallback for previews / unconfigured db
    return {
      ok: true,
      quoteNumber: `SFQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-0001`,
    };
  }

  try {
    const q = await quoteService().createQuote({
      contactName: name,
      contactEmail: email,
      contactPhone: phone!,
      customerId: session?.customer?.id,
      notes,
      items,
    });

    return {
      ok: true,
      quoteNumber: q.number,
    };
  } catch (err) {
    console.error("submitQuoteAction error", err);
    return {
      ok: false,
      formError: "Something went wrong creating your quote request. Please try again or call us.",
      values: { name, organisation, email, phone: rawPhone, county, town, items: itemsText, notes: specialNotes },
    };
  }
}
