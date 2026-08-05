"use client";

import { useEffect, useState } from "react";
import {
  fetchProgress,
  normalizeParticipantId,
  progressPercentage,
} from "../progress-sync.mjs";
import styles from "./progress.module.css";

const EMPTY_PROGRESS = {
  participantId: 1,
  planId: "sandwich",
  currentStep: 0,
  totalSteps: 0,
  updatedAt: "",
};

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
    setProgress({ ...EMPTY_PROGRESS, participantId });
    const refresh = async () => {
      try {
        const next = await fetchProgress(participantId);
        if (!cancelled) setProgress(next ?? { ...EMPTY_PROGRESS, participantId });
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

  const percentage = progressPercentage(progress);
  return (
    <main className={styles.display}>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={`${progress.currentStep}/${progress.totalSteps}`}
        aria-valuemin={0}
        aria-valuemax={progress.totalSteps}
        aria-valuenow={progress.currentStep}
      >
        <span className={styles.fill} style={{ width: `${percentage}%` }} />
      </div>
      <output className={styles.value} aria-live="polite">
        {progress.currentStep}/{progress.totalSteps}
      </output>
    </main>
  );
}
