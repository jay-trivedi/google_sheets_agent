/**
 * Phase 0 - AI Analyst (Add-on only)
 * Sidebar opens, reads selection, shows headers and a tiny sample.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI Analyst')
    .addItem('Open', 'openSidebar')
    .addToUi();
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('AI Analyst (Phase 0)');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Returns basic context for the active sheet and selection.
 * - headers: first row of the active sheet
 * - sample: values from the current selection (clamped for safety)
 */
function getContext() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  const sheetName = sh.getName();
  const sheetId = sh.getSheetId();
  const spreadsheetId = ss.getId();

  const lastRow = Math.max(1, sh.getLastRow());
  const lastCol = Math.max(1, sh.getLastColumn());

  // Header row = first row of the sheet
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  // Active selection (fallback to a small block if nothing selected)
  let rng = sh.getActiveRange();
  if (!rng) {
    rng = sh.getRange(1, 1, Math.min(20, lastRow), Math.min(10, lastCol));
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
