import { PreviewChange, summarizeChanges } from "./diff.ts";

export type SheetContext = {
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  activeRangeA1: string;
  activeRowCount: number;
  activeColumnCount: number;
  headers: readonly unknown[];
  sample: readonly (readonly unknown[])[];
};

export type PreviewResult = {
  summary: string;
  changeCount: number;
  changes: PreviewChange[];
};

function colToIndex(letter: string): number {
  let n = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i += 1) {
    n = n * 26 + (upper.charCodeAt(i) - 64);
  }
  return n;
}

function indexToCol(n: number): string {
  let s = "";
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function parseActiveRange(rangeA1: string): { startCol: number; startRow: number; width: number } {
  const match = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i.exec(rangeA1.trim());
  if (!match) throw new Error(`Unsupported A1 range: ${rangeA1}`);
  const startCol = colToIndex(match[1]);
  const startRow = parseInt(match[2], 10);
  const endCol = match[3] ? colToIndex(match[3]) : startCol;
  return { startCol, startRow, width: endCol - startCol + 1 };
}

export function computeLocalHelloPreview(context: SheetContext): PreviewResult {
  const { startCol, startRow, width } = parseActiveRange(context.activeRangeA1);
  const targetCol = startCol + width;
  const targetCell = `${indexToCol(targetCol)}${startRow}`;

  const change: PreviewChange = {
    cell: context.sheetName ? `${context.sheetName}!${targetCell}` : targetCell,
    before: undefined,
    after: "hello"
  };

  const summary = summarizeChanges([change]);

  return {
    summary: `${summary.description}`,
    changeCount: summary.changeCount,
    changes: [change]
  };
}
