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
