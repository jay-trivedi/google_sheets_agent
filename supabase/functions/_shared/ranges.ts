export type RangeInfo = {
  startCol: number;
  startRow: number;
  width: number;
  height: number;
  a1Start: string;
};

function colToIndex(letter: string): number {
  let n = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
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

export function parseRangeA1(a1: string): RangeInfo {
  const match = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i.exec(a1.trim());
  if (!match) throw new Error(`Bad A1: ${a1}`);
  const startCol = colToIndex(match[1]);
  const startRow = parseInt(match[2], 10);
  const endCol = match[3] ? colToIndex(match[3]) : startCol;
  const endRow = match[4] ? parseInt(match[4], 10) : startRow;
  return {
    startCol,
    startRow,
    width: endCol - startCol + 1,
    height: endRow - startRow + 1,
    a1Start: `${match[1].toUpperCase()}${startRow}`
  };
}

export function rangeToA1(range: RangeInfo, sheetName?: string): string {
  const startColLabel = indexToCol(range.startCol);
  const endColLabel = indexToCol(range.startCol + range.width - 1);
  const endRow = range.startRow + range.height - 1;
  const base = range.width === 1 && range.height === 1
    ? `${startColLabel}${range.startRow}`
    : `${startColLabel}${range.startRow}:${endColLabel}${endRow}`;
  return sheetName ? `${sheetName}!${base}` : base;
}

export function adjacentRight(range: RangeInfo): RangeInfo {
  return {
    startCol: range.startCol + range.width,
    startRow: range.startRow,
    width: range.width,
    height: range.height,
    a1Start: range.a1Start
  };
}
