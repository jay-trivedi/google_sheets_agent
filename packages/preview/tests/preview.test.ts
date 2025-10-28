import { describe, expect, it } from "vitest";
import { computeLocalHelloPreview } from "../src/preview";

describe("computeLocalHelloPreview", () => {
  it("describes the hello write next to active range", () => {
    const ctx = {
      spreadsheetId: "sheet-123",
      sheetId: 42,
      sheetName: "Phase 1 sheet",
      activeRangeA1: "D5:D6",
      activeRowCount: 2,
      activeColumnCount: 1,
      headers: [],
      sample: []
    };

    const result = computeLocalHelloPreview(ctx);

    expect(result.changeCount).toBe(1);
    expect(result.changes[0].cell).toBe("Phase 1 sheet!E5");
    expect(result.changes[0].after).toBe("hello");
    expect(result.summary).toContain("E5");
  });
});
