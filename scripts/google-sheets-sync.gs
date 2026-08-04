const HEADERS = [
  "recorded_at_iso",
  "log_id",
  "participant_id",
  "plan_id",
  "plan",
  "task",
  "step_name",
  "action",
  "detail",
  "event_timestamp_iso",
  "elapsed_seconds",
  "elapsed_label",
];

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const row = payload.row || {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  sheet.appendRow([
    new Date().toISOString(),
    row.log_id || "",
    row.participant_id || "",
    row.plan_id || "",
    row.plan || "",
    row.task || "",
    row.step_name || "",
    row.action || "",
    row.detail || "",
    row.event_timestamp_iso || "",
    row.elapsed_seconds || 0,
    row.elapsed_label || "",
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
