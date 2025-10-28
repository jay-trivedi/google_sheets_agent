/**
 * AI Analyst — Phase 1.1 (Add-on only)
 * - Menu + sidebar
 * - getContext(): read selection + sheet info (used by backend apply)
 * - (optional) applyLocalWriteHello(): local write for Phase 1 testing
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI Analyst')
    .addItem('Open', 'openSidebar')
    .addToUi();
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('AI Analyst (Phase 3)');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Returns basic context for the active sheet and selection.
 * Used by the sidebar to send to the backend /apply function.
 */
function getContext() {
  return _buildContext({});
}

/**
 * Execution API entry point. Accepts optional overrides so automated tests
 * can target specific spreadsheets/sheets/ranges without relying on UI state.
 *
 * @param {{spreadsheetId?: string, sheetName?: string, rangeA1?: string}} payload
 */
function apiGetContext(payload) {
  const options = payload || {};
  return {
    ok: true,
    context: _buildContext({
      spreadsheetId: options.spreadsheetId,
      sheetName: options.sheetName,
      rangeA1: options.rangeA1
    })
  };
}

/**
 * Internal helper so sidebar + Execution API share the exact same logic.
 */
function _buildContext(options) {
  const spreadsheetId = options && options.spreadsheetId;
  const sheetName = options && options.sheetName;
  const rangeA1 = options && options.rangeA1;

  const { ss, sh } = _resolveSheetAndSelection({ spreadsheetId, sheetName });

  const sheetId = sh.getSheetId();
  const resolvedSheetName = sh.getName();
  const resolvedSpreadsheetId = ss.getId();

  const lastRow = Math.max(1, sh.getLastRow());
  const lastCol = Math.max(1, sh.getLastColumn());

  // Header row = first row of the active sheet (safe if empty sheet too)
  const headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  // Active selection (fallback to a small block if nothing selected)
  const rng = _resolveRange({ sh, rangeA1, lastRow, lastCol });

  // Clamp sample size for safety
  const maxRows = 50;
  const maxCols = 20;
  const sampleRows = Math.min(rng.getNumRows(), maxRows);
  const sampleCols = Math.min(rng.getNumColumns(), maxCols);
  const sample = sh.getRange(rng.getRow(), rng.getColumn(), sampleRows, sampleCols).getValues();

  return {
    spreadsheetId: resolvedSpreadsheetId,
    sheetId,
    sheetName: resolvedSheetName,
    activeRangeA1: rng.getA1Notation(),
    activeRowCount: rng.getNumRows(),
    activeColumnCount: rng.getNumColumns(),
    headers,
    sample
  };
}

/**
 * OPTIONAL (Phase 1 legacy): local write helper
 * If you still have a "Write hello locally" button, keep this.
 * Otherwise, you can delete this function.
 */
function applyLocalWriteHello(options) {
  const opts = options || {};
  const { ss, sh } = _resolveSheetAndSelection({
    spreadsheetId: opts.spreadsheetId,
    sheetName: opts.sheetName,
  });

  const rng = _resolveRange({
    sh,
    rangeA1: opts.rangeA1,
    lastRow: Math.max(1, sh.getLastRow()),
    lastCol: Math.max(1, sh.getLastColumn()),
  });

  const startRow = rng.getRow();
  const startCol = rng.getColumn();
  const width = rng.getNumColumns();
  const targetCol = startCol + width; // one column to the right

  // Ensure grid has enough columns; expand if needed
  const gridCols = sh.getMaxColumns();
  if (targetCol > gridCols) {
    sh.insertColumnsAfter(gridCols, targetCol - gridCols);
  }

  sh.getRange(startRow, targetCol, 1, 1).setValue('hello');

  return {
    wroteA1: _toA1(startRow, targetCol),
    wroteValue: 'hello',
    selectionA1: rng.getA1Notation()
  };
}

function _resolveSheetAndSelection(opts) {
  const ss = opts.spreadsheetId ? SpreadsheetApp.openById(opts.spreadsheetId) : SpreadsheetApp.getActive();

  let sh = null;
  if (opts.sheetName) {
    sh = ss.getSheetByName(opts.sheetName);
    if (!sh) {
      throw new Error('Sheet not found: ' + opts.sheetName);
    }
  } else {
    sh = ss.getActiveSheet() || ss.getSheets()[0];
  }

  return { ss, sh };
}

function _resolveRange(opts) {
  let rng = null;
  if (opts.rangeA1) {
    rng = opts.sh.getRange(opts.rangeA1);
  } else {
    rng = opts.sh.getActiveRange();
  }
  if (!rng) {
    rng = opts.sh.getRange(1, 1, Math.min(20, opts.lastRow || 1), Math.min(10, opts.lastCol || 1));
  }
  return rng;
}

/** Helpers for A1 conversion (used by optional local write) */
function _toA1(row, col) {
  return _colToLetters(col) + String(row);
}
function _colToLetters(col) {
  let s = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
