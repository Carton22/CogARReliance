export const DEFAULT_SHEET_SYNC_URL =
  "https://script.google.com/a/macros/umn.edu/s/AKfycbz_nqJuXk07t0STgh1aKmajbJ3Af7RXAnc4iPe8ddQvqh_eaOUUbOIdoTO-7OyygQS6gw/exec";

const PLAN_IDS = new Set(["sandwich", "shelf", "boba", "table"]);

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = new Date(value);
  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
}

/**
 * @typedef {{
 *   participantId: number,
 *   planId: "sandwich" | "shelf" | "boba" | "table",
 *   currentStep: number,
 *   totalSteps: number,
 *   updatedAt: string,
 * }} ProgressState
 */

export function normalizeParticipantId(value) {
  const participantId = Number(value);
  return Number.isInteger(participantId) && participantId >= 1 && participantId <= 36
    ? participantId
    : 1;
}

export function formatParticipantLabel(value) {
  return `Participant ${String(normalizeParticipantId(value)).padStart(2, "0")}`;
}

export function participantProgressUrl(currentUrl, participantId) {
  const url = new URL(currentUrl);
  url.searchParams.set("participant", String(normalizeParticipantId(participantId)));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function normalizeProgress(value) {
  if (!value || typeof value !== "object") return null;
  const candidate = value;
  if (
    !Number.isInteger(candidate.participantId) ||
    candidate.participantId < 1 ||
    candidate.participantId > 36 ||
    !PLAN_IDS.has(candidate.planId) ||
    !Number.isInteger(candidate.currentStep) ||
    !Number.isInteger(candidate.totalSteps) ||
    candidate.totalSteps < 0 ||
    candidate.currentStep < 0 ||
    candidate.currentStep > candidate.totalSteps ||
    !isIsoTimestamp(candidate.updatedAt)
  ) return null;
  return candidate;
}

export function selectNewerProgress(current, incoming) {
  const next = normalizeProgress(incoming);
  if (!next) return current;
  const previous = normalizeProgress(current);
  if (!previous || previous.participantId !== next.participantId) return next;
  return next.updatedAt >= previous.updatedAt ? next : previous;
}

export function progressPercentage(progress) {
  if (progress.totalSteps <= 0) return 0;
  const current = Math.min(Math.max(progress.currentStep, 0), progress.totalSteps);
  return (current / progress.totalSteps) * 100;
}

export async function publishProgress(progress, fetchImpl = globalThis.fetch) {
  const normalized = normalizeProgress(progress);
  if (!normalized) throw new TypeError("Invalid progress state");
  await fetchImpl(DEFAULT_SHEET_SYNC_URL, {
    method: "POST",
    mode: "no-cors",
    credentials: "include",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ type: "progress", progress: normalized }),
  });
}

export async function fetchProgress(participantId, fetchImpl = globalThis.fetch) {
  const url = new URL(DEFAULT_SHEET_SYNC_URL);
  url.searchParams.set("participant", String(normalizeParticipantId(participantId)));
  const response = await fetchImpl(url, {
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Progress request failed");
  const body = await response.json();
  if (body?.ok !== true) throw new Error("Progress response was invalid");
  if (body.progress === null) return null;
  const normalized = normalizeProgress(body.progress);
  if (!normalized) throw new Error("Progress response was invalid");
  return normalized;
}
