"use server";

import { normaliseKenyanMobile } from "@safuney/config";
import { db, isDatabaseConfigured } from "@safuney/db";
import { getCurrentSession } from "@/lib/auth/session";

export interface CreditAppState {
  ok: boolean | null;
  applicationId?: string;
  formError?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export async function submitCreditAppAction(
  _prev: CreditAppState,
  formData: FormData,
): Promise<CreditAppState> {
  // Honeypot
  if (formData.get("website")) {
    return { ok: true, applicationId: "CR-DEMO-0001" };
  }

  const legalName = String(formData.get("legalName") ?? "").trim();
  const kraPin = String(formData.get("kraPin") ?? "").trim().toUpperCase();
  const vatNumber = String(formData.get("vatNumber") ?? "").trim();
  const rawTerms = String(formData.get("requestedTermsDays") ?? "30");
  const rawLimit = String(formData.get("requestedLimitKES") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const rawPhone = String(formData.get("contactPhone") ?? "").trim();

  // Trade references
  const ref1Company = String(formData.get("ref1Company") ?? "").trim();
  const ref1Contact = String(formData.get("ref1Contact") ?? "").trim();
  const ref1Phone = String(formData.get("ref1Phone") ?? "").trim();

  const ref2Company = String(formData.get("ref2Company") ?? "").trim();
  const ref2Contact = String(formData.get("ref2Contact") ?? "").trim();
  const ref2Phone = String(formData.get("ref2Phone") ?? "").trim();

  const fieldErrors: Record<string, string> = {};

  if (!legalName) fieldErrors["legalName"] = "Enter the registered legal entity name.";
  if (!kraPin || kraPin.length < 10) fieldErrors["kraPin"] = "Enter a valid KRA PIN (e.g. P051234567Z).";
  const phone = normaliseKenyanMobile(rawPhone);
  if (!phone) fieldErrors["contactPhone"] = "Enter a valid Kenyan mobile number for the purchasing officer.";
  if (!contactEmail || !contactEmail.includes("@")) fieldErrors["contactEmail"] = "Enter a valid corporate email.";

  const limitNumber = parseInt(rawLimit.replace(/[^0-9]/g, ""), 10);
  if (!limitNumber || limitNumber < 10000) {
    fieldErrors["requestedLimitKES"] = "Enter a valid credit limit of at least KES 10,000.";
  }

  if (!ref1Company || !ref1Contact || !ref1Phone) {
    fieldErrors["ref1"] = "Please supply at least one commercial trade reference.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      values: {
        legalName,
        kraPin,
        vatNumber,
        requestedLimitKES: rawLimit,
        requestedTermsDays: rawTerms,
        contactName,
        contactEmail,
        contactPhone: rawPhone,
        ref1Company,
        ref1Contact,
        ref1Phone,
        ref2Company,
        ref2Contact,
        ref2Phone,
      },
    };
  }

  const termsDays = parseInt(rawTerms, 10) === 45 ? 45 : 30;
  const limitMinorUnits = BigInt(limitNumber) * 100n;

  const tradeReferences = [
    { company: ref1Company, contact: ref1Contact, phone: ref1Phone },
    ...(ref2Company ? [{ company: ref2Company, contact: ref2Contact, phone: ref2Phone }] : []),
  ];

  if (!isDatabaseConfigured()) {
    return {
      ok: true,
      applicationId: `CR-DEMO-${Date.now().toString().slice(-4)}`,
    };
  }

  try {
    const prisma = db();
    const session = await getCurrentSession();

    // Find or create customer
    let customerId = session?.customer?.id;
    if (!customerId) {
      const cust = await prisma.customer.create({
        data: {
          displayName: legalName,
          legalName,
          kraPin,
          vatNumber: vatNumber || null,
          type: "ORGANISATION",
          status: "PENDING_CREDIT_APPROVAL",
          creditLimitMinorUnits: 0n,
          creditTermsDays: termsDays,
        },
      });
      customerId = cust.id;
    }

    const app = await prisma.creditApplication.create({
      data: {
        customerId,
        legalName,
        kraPin,
        tradeReferences,
        documents: [],
        requestedLimitMinorUnits: limitMinorUnits,
        requestedTermsDays: termsDays,
        status: "PENDING",
      },
    });

    return {
      ok: true,
      applicationId: app.id,
    };
  } catch (err) {
    console.error("submitCreditAppAction error", err);
    return {
      ok: false,
      formError: "Could not submit application. Please check your network or call Safuney directly.",
    };
  }
}
