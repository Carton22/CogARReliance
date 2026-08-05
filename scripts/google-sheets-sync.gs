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

function progressKey(participantId) {
  return `progress:${participantSheetName(participantId)}`;
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = new Date(value);
  return !isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
}

function normalizeProgress(progress) {
  const participantId = Number(progress && progress.participantId);
  const currentStep = Number(progress && progress.currentStep);
  const totalSteps = Number(progress && progress.totalSteps);
  const planIds = ["sandwich", "shelf", "boba", "table"];
  if (
    !Number.isInteger(participantId) || participantId < 1 || participantId > 36 ||
    planIds.indexOf(progress.planId) === -1 ||
    !Number.isInteger(currentStep) || !Number.isInteger(totalSteps) ||
    totalSteps < 0 || currentStep < 0 || currentStep > totalSteps ||
    !isIsoTimestamp(progress.updatedAt)
  ) return null;
  return { participantId, planId: progress.planId, currentStep, totalSteps, updatedAt: progress.updatedAt };
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  if (payload.type === "progress") {
    const progress = normalizeProgress(payload.progress);
    if (!progress) return jsonResponse({ ok: false, error: "invalid_progress" });
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const properties = PropertiesService.getDocumentProperties();
      const key = progressKey(progress.participantId);
      const stored = properties.getProperty(key);
      const latest = stored ? normalizeProgress(JSON.parse(stored)) : null;
      if (latest && progress.updatedAt < latest.updatedAt) {
        return jsonResponse({ ok: true, stale: true });
      }
      properties.setProperty(key, JSON.stringify(progress));
      return jsonResponse({ ok: true });
    } finally {
      lock.releaseLock();
    }
  }

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

  return jsonResponse({ ok: true });
}

function doGet(event) {
  const participant = event && event.parameter && event.parameter.participant;
  const participantId = Number(participant);
  if (Number.isInteger(participantId) && participantId >= 1 && participantId <= 36) {
    const stored = PropertiesService
      .getDocumentProperties()
      .getProperty(progressKey(participantId));
    return jsonResponse({ ok: true, progress: stored ? JSON.parse(stored) : null });
  }
  return jsonResponse({ ok: true, service: "cogar-study-console-sync" });
}
