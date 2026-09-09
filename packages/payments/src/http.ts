import { PaymentProviderError, type Fetch } from "./types";

/** fetch with a hard timeout; provider outages must surface as TIMEOUT, never hang checkout. */
export async function fetchJson(
  fetchImpl: Fetch,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  timeoutMs: number,
): Promise<{ status: number; ok: boolean; json: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, json, text };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new PaymentProviderError("TIMEOUT", `Provider did not answer within ${timeoutMs} ms`);
    throw new PaymentProviderError("NETWORK", "Could not reach the payment provider", e);
  } finally {
    clearTimeout(timer);
  }
}

export function defaultFetch(): Fetch {
  return (input, init) => fetch(input, init as RequestInit) as unknown as ReturnType<Fetch>;
}
