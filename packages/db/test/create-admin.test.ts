import { describe, expect, it } from "vitest";
import { base32 } from "../src/create-admin";

describe("create-admin authenticator key", () => {
  it("encodes base32 per RFC 4648 (unpadded)", () => {
    for (const [plain, encoded] of [["", ""], ["f", "MY"], ["fo", "MZXQ"], ["foo", "MZXW6"], ["foob", "MZXW6YQ"], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI"]] as const) {
      expect(base32(Buffer.from(plain))).toBe(encoded);
    }
  });

  it("gives a 20-byte secret the 32 characters authenticator apps expect", () => {
    expect(base32(Buffer.alloc(20, 0xff))).toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe("check-admin", () => {
  it("computes the RFC 6238 SHA-1 test vectors (last six digits)", async () => {
    const { totpNow } = await import("../src/check-admin");
    // ASCII "12345678901234567890" in base32.
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpNow(secret, 59_000)).toBe("287082");
    expect(totpNow(secret, 1_111_111_109_000)).toBe("081804");
    expect(totpNow(secret, 2_000_000_000_000)).toBe("279037");
  });

  it("agrees with the key create-admin generates", async () => {
    const { totpNow } = await import("../src/check-admin");
    const { base32 } = await import("../src/create-admin");
    expect(totpNow(base32(Buffer.from("12345678901234567890")), 59_000)).toBe("287082");
  });
});
