const HEADERS = [
  "participant_id",
  "plan_id",
  "plan",
  "step",
  "step_name",
  "action",
  "detail",
  "event_timestamp_iso",
];

function participantSheetName(participantId) {
  const numericId = Number(participantId) || 0;
  return `P${String(numericId).padStart(2, "0")}`;
}

function sheetForParticipant(spreadsheet, participantId) {
  const name = participantSheetName(participantId);
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  const needsHeaders = currentHeaders.some((cell, index) => cell !== HEADERS[index]);

  if (needsHeaders) {
    headerRange.setValues([HEADERS]);
  }
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const row = payload.row || {};
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetForParticipant(spreadsheet, row.participant_id);

  ensureHeaders(sheet);
  sheet.appendRow([
    row.participant_id || "",
    row.plan_id || "",
    row.plan || "",
    row.task || "",
    row.step_name || "",
    row.action || "",
    row.detail || "",
    row.event_timestamp_iso || "",
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: "cogar-study-console-sync" }))
    .setMimeType(ContentService.MimeType.JSON);
}
