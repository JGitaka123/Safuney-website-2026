import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/seed";

describe("catalogue CSV parser", () => {
  it("handles quoted commas and escaped quotes", () => {
    const rows = parseCsv('a,b,c\n1,"x, y","he said ""hi"""\n');
    expect(rows).toEqual([{ a: "1", b: "x, y", c: 'he said "hi"' }]);
  });
  it("tolerates CRLF and blank lines", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ a: "3", b: "4" });
  });
});
