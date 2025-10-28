import { computeEdgeHash, computeFormatHash, computeHeaderHash, DEFAULT_EDGE_ROWS } from "../../sheets-tools/src/fingerprint.ts";

export type VerifyReason = "ROW_COUNT" | "COL_COUNT" | "EDGE_HASH" | "HEADER_CHANGED" | "FORMAT_CHANGED";

export type Fingerprint = {
  range: string;
  rowCount: number;
  colCount: number;
  edgeHash: string;
  headerHash?: string;
  formatHash?: string;
};

export type VerifyResult =
  | { ok: true; fingerprint: Fingerprint }
  | { ok: false; fingerprint: Fingerprint; reason: VerifyReason; changedAt?: { row?: number; col?: number } };

export interface CasApi {
  fingerprintRange(input: { spreadsheetId: string; rangeA1: string; edgeRows?: number; includeFormats?: boolean }): Promise<Fingerprint>;
  fingerprintMany(input: { spreadsheetId: string; rangesA1: string[]; edgeRows?: number; includeFormats?: boolean }): Promise<Fingerprint[]>;
  verify(input: { spreadsheetId: string; before: Fingerprint; edgeRows?: number; includeFormats?: boolean }): Promise<VerifyResult>;
  verifyMany(input: {
    spreadsheetId: string;
    before: Fingerprint[];
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<VerifyResult[]>;
}

export type RangeSnapshot = {
  range: string;
  values: unknown[][];
  fingerprint: Fingerprint;
  formats?: unknown[][];
};

export interface CasSnapshotApi extends CasApi {
  snapshotRange(input: { spreadsheetId: string; rangeA1: string; edgeRows?: number; includeFormats?: boolean }): Promise<RangeSnapshot>;
  snapshotMany(input: {
    spreadsheetId: string;
    rangesA1: string[];
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<RangeSnapshot[]>;
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type RangeInfo = {
  startCol: number;
  startRow: number;
  width: number;
  height: number;
};

const A1_REGEX = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i;

function colToIndex(letter: string): number {
  let n = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i += 1) {
    n = n * 26 + (upper.charCodeAt(i) - 64);
  }
  return n;
}

function parseRange(range: string): RangeInfo {
  const match = A1_REGEX.exec(range.trim());
  if (!match) {
    throw new Error(`Unsupported A1 range: ${range}`);
  }
  const startCol = colToIndex(match[1]);
  const startRow = parseInt(match[2], 10);
  const endCol = match[3] ? colToIndex(match[3]) : startCol;
  const endRow = match[4] ? parseInt(match[4], 10) : startRow;
  return {
    startCol,
    startRow,
    width: endCol - startCol + 1,
    height: endRow - startRow + 1
  };
}

function splitSheetAndRange(rangeA1: string): { sheetName?: string; range: string } {
  const bangIndex = rangeA1.indexOf("!");
  if (bangIndex === -1) return { range: rangeA1 };
  return { sheetName: rangeA1.slice(0, bangIndex), range: rangeA1.slice(bangIndex + 1) };
}

function padMatrix(values: readonly (readonly unknown[])[], height: number, width: number): unknown[][] {
  const rows: unknown[][] = new Array(height);
  for (let r = 0; r < height; r += 1) {
    const source = values[r] ?? [];
    const row: unknown[] = new Array(width);
    for (let c = 0; c < width; c += 1) {
      row[c] = c < source.length ? source[c] : "";
    }
    rows[r] = row;
  }
  return rows;
}

function buildFingerprint(opts: {
  rangeA1: string;
  values: unknown[][];
  info: RangeInfo;
  edgeRows: number;
  includeFormats: boolean;
  formats?: unknown[][];
}): Fingerprint {
  const edgeHash = computeEdgeHash(opts.values, { edgeRows: opts.edgeRows, includeHeader: true });
  const headerHash = opts.values.length > 0 ? computeHeaderHash(opts.values[0]) : undefined;
  const formatHash =
    opts.includeFormats && opts.formats
      ? computeFormatHash(opts.formats, { edgeRows: opts.edgeRows })
      : undefined;

  return {
    range: opts.rangeA1,
    rowCount: opts.info.height,
    colCount: opts.info.width,
    edgeHash,
    headerHash,
    formatHash
  };
}

async function fetchValueRanges(opts: {
  fetcher: FetchLike;
  accessToken: string;
  spreadsheetId: string;
  ranges: string[];
}): Promise<readonly (readonly unknown[])[][]> {
  const params = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE"
  });
  for (const range of opts.ranges) {
    params.append("ranges", range);
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${opts.spreadsheetId}/values:batchGet?${params.toString()}`;
  const res = await opts.fetcher(url, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load ranges: ${res.status} ${res.statusText} ${text}`);
  }
  const json = await res.json();
  const valueRanges = Array.isArray(json?.valueRanges) ? json.valueRanges : [];
  const matrices: (readonly (readonly unknown[])[])[] = [];
  for (let i = 0; i < opts.ranges.length; i += 1) {
    const valueRange = valueRanges[i];
    const values = Array.isArray(valueRange?.values) ? valueRange.values : [];
    matrices.push(values);
  }
  return matrices;
}

export function compareFingerprints(before: Fingerprint, current: Fingerprint, includeFormats = false): VerifyResult {
  if (current.rowCount !== before.rowCount) {
    return {
      ok: false,
      fingerprint: current,
      reason: "ROW_COUNT",
      changedAt: { row: Math.min(current.rowCount, before.rowCount) + 1 }
    };
  }
  if (current.colCount !== before.colCount) {
    return {
      ok: false,
      fingerprint: current,
      reason: "COL_COUNT",
      changedAt: { col: Math.min(current.colCount, before.colCount) + 1 }
    };
  }
  if (before.headerHash && current.headerHash && current.headerHash !== before.headerHash) {
    return {
      ok: false,
      fingerprint: current,
      reason: "HEADER_CHANGED"
    };
  }
  if (includeFormats && before.formatHash && current.formatHash !== before.formatHash) {
    return {
      ok: false,
      fingerprint: current,
      reason: "FORMAT_CHANGED"
    };
  }
  if (current.edgeHash !== before.edgeHash) {
    return {
      ok: false,
      fingerprint: current,
      reason: "EDGE_HASH"
    };
  }
  return { ok: true, fingerprint: current };
}

export function createCasApi(opts: { accessToken: string; fetchImpl?: FetchLike }): CasSnapshotApi {
  const fetcher = opts.fetchImpl ?? fetch;
  const accessToken = opts.accessToken;

  async function snapshotMany(params: {
    spreadsheetId: string;
    rangesA1: string[];
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<RangeSnapshot[]> {
    if (params.rangesA1.length === 0) return [];
    const edgeRows = params.edgeRows ?? DEFAULT_EDGE_ROWS;
    const includeFormats = params.includeFormats ?? false;

    const valuesMatrices = await fetchValueRanges({
      fetcher,
      accessToken,
      spreadsheetId: params.spreadsheetId,
      ranges: params.rangesA1
    });

    return params.rangesA1.map((rangeA1, idx) => {
      const { range } = splitSheetAndRange(rangeA1);
      const info = parseRange(range);
      const paddedValues = padMatrix(valuesMatrices[idx] ?? [], info.height, info.width);
      const fingerprint = buildFingerprint({
        rangeA1,
        values: paddedValues,
        info,
        edgeRows,
        includeFormats
      });
      return {
        range: rangeA1,
        values: paddedValues,
        fingerprint
      };
    });
  }

  async function snapshotRange(params: {
    spreadsheetId: string;
    rangeA1: string;
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<RangeSnapshot> {
    const [single] = await snapshotMany({
      spreadsheetId: params.spreadsheetId,
      rangesA1: [params.rangeA1],
      edgeRows: params.edgeRows,
      includeFormats: params.includeFormats
    });
    if (!single) {
      throw new Error(`No data returned for range ${params.rangeA1}`);
    }
    return single;
  }

  async function fingerprintRange(params: {
    spreadsheetId: string;
    rangeA1: string;
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<Fingerprint> {
    const snapshot = await snapshotRange(params);
    return snapshot.fingerprint;
  }

  async function fingerprintMany(params: {
    spreadsheetId: string;
    rangesA1: string[];
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<Fingerprint[]> {
    const snapshots = await snapshotMany(params);
    return snapshots.map((snap) => snap.fingerprint);
  }

  async function verify(params: {
    spreadsheetId: string;
    before: Fingerprint;
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<VerifyResult> {
    const current = await fingerprintRange({
      spreadsheetId: params.spreadsheetId,
      rangeA1: params.before.range,
      edgeRows: params.edgeRows,
      includeFormats: params.includeFormats
    });
    return compareFingerprints(params.before, current, params.includeFormats);
  }

  async function verifyMany(params: {
    spreadsheetId: string;
    before: Fingerprint[];
    edgeRows?: number;
    includeFormats?: boolean;
  }): Promise<VerifyResult[]> {
    return Promise.all(
      params.before.map((fp) =>
        verify({
          spreadsheetId: params.spreadsheetId,
          before: fp,
          edgeRows: params.edgeRows,
          includeFormats: params.includeFormats
        })
      )
    );
  }

  return {
    fingerprintRange,
    fingerprintMany,
    verify,
    verifyMany,
    snapshotRange,
    snapshotMany
  };
}
