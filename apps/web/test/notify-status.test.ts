import { describe, expect, it } from "vitest";
import { notifyOrderStatus } from "@/lib/notify";

const base = { number: "SFN-20260909-0001", accessToken: "tok", email: "a@example.test", phone: "+254712345678", totalMinorUnits: 79080n, paymentMethod: "COD", status: "DISPATCHED", baseUrl: "https://example.test", items: [] };

describe("status notifications", () => {
  it("degrade to off when no email or SMS provider is configured", async () => {
    delete process.env["RESEND_API_KEY"];
    delete process.env["AT_API_KEY"];
    expect(await notifyOrderStatus(base, "PACKED")).toEqual({ email: "off", sms: "off" });
    expect(await notifyOrderStatus(base, "DISPATCHED", { riderName: "Rider Joe", riderPhone: "0700000000" })).toEqual({ email: "off", sms: "off" });
    expect(await notifyOrderStatus({ ...base, email: null, phone: null }, "DELIVERED", { receivedBy: "Chef" })).toEqual({ email: "off", sms: "off" });
  });
});
