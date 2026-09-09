import type { Metadata } from "next";
import { paymentsMode } from "@safuney/payments";
import { CardReturn } from "@/components/checkout/card-return";

export const metadata: Metadata = { title: "Confirming payment", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<{ order?: string; token?: string }> }) {
  const { order, token } = await searchParams;
  return <CardReturn orderNumber={order ?? null} accessToken={token ?? null} mockMode={paymentsMode() === "mock"} />;
}
