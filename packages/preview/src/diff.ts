export type PreviewChange = {
  cell: string;
  before?: unknown;
  after: unknown;
};

export type ChangeSummary = {
  changeCount: number;
  description: string;
};

export function summarizeChanges(changes: readonly PreviewChange[]): ChangeSummary {
  const changeCount = changes.length;
  const description =
    changeCount === 0
      ? "No visible changes."
      : changeCount === 1
      ? `Will update 1 cell (${changes[0].cell}).`
      : `Will update ${changeCount} cells (first: ${changes[0].cell}).`;
  return { changeCount, description };
}

export function formatChange(change: PreviewChange): string {
  const before =
    change.before === undefined ? "〈empty〉" : JSON.stringify(change.before);
  const after = JSON.stringify(change.after);
  return `${change.cell}: ${before} → ${after}`;
}
