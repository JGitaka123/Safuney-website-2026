/**
 * Contact-form topics. Kept free of server-only imports so the client form can use them;
 * lib/leads.ts re-exports them for the server side.
 */
import type { LeadKind } from "@safuney/db";

export const LEAD_TOPICS = ["contact", "quote", "credit", "services"] as const;
export type LeadTopic = (typeof LEAD_TOPICS)[number];

export function isLeadTopic(value: unknown): value is LeadTopic {
  return typeof value === "string" && (LEAD_TOPICS as readonly string[]).includes(value);
}

/** Option labels for the topic select. */
export const topicLabels: Record<LeadTopic, string> = {
  contact: "General enquiry",
  quote: "Request a quote",
  credit: "Open a credit account",
  services: "Support services",
};

/** Submit button labels: the label is the outcome (plan §6.1). */
export const submitLabels: Record<LeadTopic, string> = {
  contact: "Send message",
  quote: "Request a quote",
  credit: "Ask about a credit account",
  services: "Send message",
};

export function topicToLeadKind(topic: LeadTopic): LeadKind {
  switch (topic) {
    case "quote":
      return "QUOTE_REQUEST";
    case "credit":
    case "services":
      return "CALLBACK";
    case "contact":
      return "CONTACT";
  }
}

export type LeadField = "name" | "organisation" | "email" | "phone" | "topic" | "message" | "consent";
export type FieldErrors = Partial<Record<LeadField, string>>;
