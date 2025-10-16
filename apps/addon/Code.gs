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
    .setTitle('AI Analyst (Phase 1.1)');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Returns basic context for the active sheet and selection.
 * Used by the sidebar to send to the backend /apply function.
 */
function getContext() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  const sheetName = sh.getName();
  const sheetId = sh.getSheetId();
  const spreadsheetId = ss.getId();

  const lastRow = Math.max(1, sh.getLastRow());
  const lastCol = Math.max(1, sh.getLastColumn());

  // Header row = first row of the active sheet (safe if empty sheet too)
  const headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  // Active selection (fallback to a small block if nothing selected)
  let rng = sh.getActiveRange();
  if (!rng) {
    rng = sh.getRange(1, 1, Math.min(20, lastRow || 1), Math.min(10, lastCol || 1));
  }

  // Clamp sample size for safety
  const maxRows = 50;
  const maxCols = 20;
  const sampleRows = Math.min(rng.getNumRows(), maxRows);
  const sampleCols = Math.min(rng.getNumColumns(), maxCols);
  const sample = sh.getRange(rng.getRow(), rng.getColumn(), sampleRows, sampleCols).getValues();

  return {
    spreadsheetId,
    sheetId,
    sheetName,
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
function applyLocalWriteHello() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  let rng = sh.getActiveRange();
  if (!rng) {
    throw new Error('Select a range first.');
  }

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
