export type PatchState = {
  range: string;
  values: unknown[][];
  undo?: {
    undoneAt: string;
  };
};

export type PatchInsert = {
  spreadsheet_id: string;
  user_id: string;
  plan_id?: string | null;
  touched_ranges: string[];
  before_state: PatchState | null;
  after_state: PatchState | null;
};

export function buildSingleCellPatch(opts: {
  spreadsheetId: string;
  userId: string;
  planId?: string | null;
  range: string;
  beforeValues: unknown[][];
  afterValues: unknown[][];
}): PatchInsert {
  const touched_ranges = [opts.range];
  return {
    spreadsheet_id: opts.spreadsheetId,
    user_id: opts.userId,
    plan_id: opts.planId ?? null,
    touched_ranges,
    before_state: {
      range: opts.range,
      values: opts.beforeValues
    },
    after_state: {
      range: opts.range,
      values: opts.afterValues
    }
  };
}

export function markUndo(afterState: PatchState | null, undoneAt: string): PatchState | null {
  if (!afterState) return null;
  return {
    ...afterState,
    undo: {
      undoneAt
    }
  } as PatchState;
}
