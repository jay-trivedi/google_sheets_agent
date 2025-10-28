/**
 * Fingerprinting helpers for Google Sheets ranges.
 * Produces stable 64-bit hashes over selected rows to enable CAS checks.
 */

export const DEFAULT_EDGE_ROWS = 20;

export interface EdgeHashOptions {
  edgeRows?: number;
  includeHeader?: boolean;
  includeFormats?: boolean;
}

const FNV_OFFSET_BASIS = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);
const encoder = new TextEncoder();

function fnv1a64(input: Uint8Array): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input[i]);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "BLANK";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NUM:NaN";
    if (!Number.isFinite(value)) return value > 0 ? "NUM:+INF" : "NUM:-INF";
    return `NUM:${value.toString(10)}`;
  }
  if (typeof value === "boolean") return value ? "BOOL:1" : "BOOL:0";
  if (value instanceof Date) return `DATE:${value.toISOString()}`;
  if (typeof value === "object") return `OBJ:${JSON.stringify(value)}`;
  const str = String(value);
  if (str === "") return "BLANK";
  return `STR:${str.replace(/\r\n?/g, "\n")}`;
}

function normalizeRow(row: readonly unknown[], colCount: number): string[] {
  const out: string[] = new Array(colCount);
  for (let col = 0; col < colCount; col += 1) {
    const cell = col < row.length ? row[col] : "";
    out[col] = normalizeCell(cell);
  }
  return out;
}

function collectEdgeRowIndexes(rowCount: number, includeHeader: boolean, edgeRows: number): number[] {
  if (rowCount === 0) return [];
  const firstDataRow = includeHeader ? 1 : 0;
  const lastRowIndex = rowCount - 1;
  const indexes = new Set<number>();

  if (includeHeader && rowCount > 0) {
    indexes.add(0);
  }

  for (let i = 0; i < edgeRows; i += 1) {
    const idx = firstDataRow + i;
    if (idx <= lastRowIndex) indexes.add(idx);
    const tailIdx = lastRowIndex - i;
    if (tailIdx >= firstDataRow) indexes.add(tailIdx);
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

function hashRows(rows: readonly (readonly unknown[])[], colCount: number, indexes: readonly number[]): string {
  const parts: string[] = [];
  for (const index of indexes) {
    const row = index < rows.length ? rows[index] : [];
    parts.push(`#${index}`);
    parts.push(normalizeRow(row, colCount).join("\u0001"));
  }
  return fnv1a64(encoder.encode(parts.join("\u0002")));
}

function resolveColCount(values: readonly (readonly unknown[])[]): number {
  return values.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
}

export function computeEdgeHash(values: readonly (readonly unknown[])[], opts: EdgeHashOptions = {}): string {
  const edgeRows = opts.edgeRows ?? DEFAULT_EDGE_ROWS;
  const includeHeader = opts.includeHeader ?? true;
  const colCount = resolveColCount(values);
  const rowIndexes = collectEdgeRowIndexes(values.length, includeHeader, edgeRows);
  return hashRows(values, colCount, rowIndexes);
}

export function computeHeaderHash(header: readonly unknown[]): string {
  const row = normalizeRow(header, header.length);
  return fnv1a64(encoder.encode(row.join("\u0001")));
}

export function computeFormatHash(
  formats: readonly (readonly unknown[])[],
  opts: { edgeRows?: number } = {}
): string {
  const edgeRows = opts.edgeRows ?? DEFAULT_EDGE_ROWS;
  const colCount = resolveColCount(formats);
  const indexes = collectEdgeRowIndexes(formats.length, true, edgeRows);
  return hashRows(formats, colCount, indexes);
}
