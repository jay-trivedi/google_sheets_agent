import { describe, expect, it } from "vitest";
import { computeEdgeHash, computeHeaderHash, computeFormatHash } from "../src/fingerprint";

describe("fingerprint helpers", () => {
  const matrix = [
    ["Header A", "Header B"],
    ["foo", 123],
    ["bar", 456]
  ];

  it("produces stable edge hash for identical matrices", () => {
    const hash1 = computeEdgeHash(matrix);
    const hash2 = computeEdgeHash([
      ["Header A", "Header B"],
      ["foo", 123],
      ["bar", 456]
    ]);
    expect(hash1).toBe(hash2);
  });

  it("changes edge hash when a tracked cell updates", () => {
    const original = computeEdgeHash(matrix);
    const mutated = computeEdgeHash([
      ["Header A", "Header B"],
      ["foo", 999],
      ["bar", 456]
    ]);
    expect(mutated).not.toBe(original);
  });

  it("computes header hash independent of data rows", () => {
    const headerHash = computeHeaderHash(["H1", "H2"]);
    const headerHash2 = computeHeaderHash(["H1", "H2"]);
    expect(headerHash).toBe(headerHash2);
  });

  it("computes format hash over provided grid", () => {
    const formats = [
      ["FORMAT_A", "FORMAT_B"],
      ["F1", "F2"]
    ];
    const hash1 = computeFormatHash(formats);
    const hash2 = computeFormatHash(formats);
    expect(hash1).toBe(hash2);
  });
});
