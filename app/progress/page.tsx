"use client";

import { useEffect, useState } from "react";
import {
  fetchProgress,
  formatParticipantLabel,
  normalizeParticipantId,
  participantProgressUrl,
  progressPercentage,
  selectNewerProgress,
} from "../progress-sync.mjs";
import styles from "./progress.module.css";

const EMPTY_PROGRESS = {
  participantId: 1,
  planId: "sandwich",
  currentStep: 0,
  totalSteps: 0,
  updatedAt: "",
};

const emptyProgress = (participantId: number) => ({
  ...EMPTY_PROGRESS,
  participantId,
});

export default function ProgressPage() {
  const [participantId, setParticipantId] = useState(1);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    // The participant id is browser-only state derived on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticipantId(normalizeParticipantId(query.get("participant")));
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Reset synchronously before the next participant's first fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(emptyProgress(participantId));
    const refresh = async () => {
      try {
        const next = await fetchProgress(participantId);
        if (!cancelled) {
          setProgress((current) =>
            next === null
              ? emptyProgress(participantId)
              : selectNewerProgress(current, next),
          );
        }
      } catch {
        // Intentionally retain the last valid value without adding visible UI.
      }
    };
    void refresh();
    const poller = window.setInterval(() => void refresh(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [participantId]);

  const handleParticipantChange = (value: string) => {
    const nextParticipantId = normalizeParticipantId(value);
    if (nextParticipantId === participantId) return;

    const confirmed = window.confirm(
      `Switch progress display from ${formatParticipantLabel(participantId)} to ${formatParticipantLabel(nextParticipantId)}?`,
    );
    if (!confirmed) return;

    setProgress(emptyProgress(nextParticipantId));
    window.history.replaceState(
      window.history.state,
      "",
      participantProgressUrl(window.location.href, nextParticipantId),
    );
    setParticipantId(nextParticipantId);
  };

  const percentage = progressPercentage(progress);
  return (
    <main className={styles.display}>
      <label className={styles.participantPicker}>
        <span>Participant</span>
        <select
          value={participantId}
          onChange={(event) => handleParticipantChange(event.target.value)}
          aria-label="Progress participant"
        >
          {Array.from({ length: 36 }, (_, index) => index + 1).map((id) => (
            <option key={id} value={id}>
              {formatParticipantLabel(id)}
            </option>
          ))}
        </select>
      </label>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={`${progress.currentStep}/${progress.totalSteps}`}
        aria-valuetext={`${progress.currentStep}/${progress.totalSteps}`}
        aria-valuemin={progress.totalSteps > 0 ? 0 : undefined}
        aria-valuemax={progress.totalSteps > 0 ? progress.totalSteps : undefined}
        aria-valuenow={progress.totalSteps > 0 ? progress.currentStep : undefined}
      >
        <span className={styles.fill} style={{ width: `${percentage}%` }} />
      </div>
      <output className={styles.value} aria-live="polite">
        {progress.currentStep}/{progress.totalSteps}
      </output>
    </main>
  );
}
