import type { NextRequest } from "next/server";
import type { RawCallback } from "@safuney/payments";

/** Turn a Next request into the provider-agnostic RawCallback (raw body bytes preserved for HMACs). */
export async function toRawCallback(req: NextRequest, params: Record<string, string> = {}): Promise<RawCallback> {
  const body = await req.text();
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const ip = (headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() || headers["x-real-ip"] || undefined;
  return { body, headers, ip, params };
}
