"use client";

import {
  type TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_SHEET_SYNC_URL, publishProgress } from "./progress-sync.mjs";

type Decision = "accept" | "reject";
type PlanId = "training" | "sandwich" | "shelf" | "boba" | "table";
type CueKind = "correct" | "incorrect";

type TaskState = {
  audioPlays: number;
  decision?: Decision;
};

type LogEntry = {
  id: string;
  participantId: number;
  planId: PlanId;
  planTitle: string;
  task: number;
  stepName: string;
  action: string;
  detail: string;
  timestamp: string;
  elapsed: number;
};

type InstructionOption = {
  audioSrc: string;
  text: string;
};

type Task = {
  name: string;
  correctOptions: InstructionOption[];
  incorrectOptions?: InstructionOption[];
  mainKind: CueKind;
};

type Plan = {
  id: PlanId;
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  tasks: Task[];
};

const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const DISTRACTOR_INSERT_WINDOWS = [
  { label: "A", allowedAfterCorrectSteps: [1, 2, 3] },
  { label: "B", allowedAfterCorrectSteps: [3, 4, 5] },
  { label: "C", allowedAfterCorrectSteps: [5, 6, 7] },
];

const trainingCorrectSteps = [
  "Put a long piece on the ground",
  "Put a square piece at slot 1",
  "Put a square piece at slot 2",
  "Put a square piece at slot 3",
  "Put a long piece on the top",
];

const sandwichCorrectSteps = [
  "Take a plate",
  "Put a bread into the plate",
  "Add a piece of cheese",
  "Add a piece of ham",
  "Add ketchup",
  "Add a bread on top",
  "Put into microwave",
];

const shelfCorrectSteps = [
  "Classify the pieces based on color",
  "Insert a green at slot 1 of the yellow",
  "Insert a pink piece at slot 2 of the yellow",
  "Insert another 2 pink at slot 3 and 4",
  "Insert a green piece at slot 5",
  "Connect another yellow with the green and pink",
  "Connect a blue piece with the 2 green",
];

const bobaCorrectSteps = [
  "Add strawberry sugar syrup into a cup",
  "Add boba",
  "Add the yogurt as bottom layer",
  "Pour matcha latte",
  "Pour coconut milk",
  "Add milk cream on the top",
  "Add matcha powder",
];

const tableCorrectSteps = [
  "Insert a No.4 at slot 1 of a No.3",
  "Connect another No.3 with the No.4",
  "Insert a No.4 at slot 2 of the No.3",
  "Connect a No.1 on top of the 2 No.3",
  "Connect a No.2 with the No.1",
  "Connect 2 No.5 with a No.6",
  "Connect another No.6 with the No.5",
];

const sandwichDistractorSteps = [
  "Add peppers",
  "Add the green celery",
  "Add water into a cup",
];

const shelfDistractorSteps = [
  "Insert a purple at slot 3 of the yellow",
  "Insert a pink piece at slot 5",
  "Take a black piece",
];

const bobaDistractorSteps = [
  "Add white sugar to the cup",
  "Mix up the current cup",
  "Add a piece of lemon on the edge",
];

const tableDistractorSteps = [
  "Take a cutting knife",
  "Connect a No.5 with a No.9",
  "Connect a No.6 with a No.8",
];

const randomizedTaskConfigs = {
  sandwich: {
    correct: correctTasks(sandwichCorrectSteps, "sandwich", "sandwich"),
    distractorSteps: sandwichDistractorSteps,
    folder: "sandwich-distractors",
    prefix: "sandwich",
    distractors: ["A", "B", "C"],
  },
  shelf: {
    correct: correctTasks(shelfCorrectSteps, "shelf-assembly", "shelf"),
    distractorSteps: shelfDistractorSteps,
    folder: "shelf-assembly-distractors",
    prefix: "shelf",
    distractors: ["A", "B", "C"],
  },
  boba: {
    correct: correctTasks(bobaCorrectSteps, "boba", "boba"),
    distractorSteps: bobaDistractorSteps,
    folder: "boba-distractors",
    prefix: "boba",
    distractors: ["A", "B", "C"],
  },
  table: {
    correct: correctTasks(tableCorrectSteps, "table-assembly", "table_assembly"),
    distractorSteps: tableDistractorSteps,
    folder: "table-assembly-distractors",
    prefix: "table_assembly",
    distractors: ["A", "B", "C"],
  },
} satisfies Record<
  "sandwich" | "shelf" | "boba" | "table",
  {
    correct: Task[];
    distractorSteps: string[];
    folder: string;
    prefix: string;
    distractors: string[];
  }
>;

function correctTasks(
  steps: string[],
  audioFolder: string,
  audioPrefix: string,
): Task[] {
  return steps.map((text, index) => ({
    name: text,
    correctOptions: [
      {
        text,
        audioSrc: `/audio/${audioFolder}/${audioPrefix}_${String(index + 1).padStart(2, "0")}.mp3`,
      },
    ],
    mainKind: "correct",
  }));
}

function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (const character of seedText) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomizedStudyTasks(
  planId: "sandwich" | "shelf" | "boba" | "table",
  participantId: number,
) {
  const config = randomizedTaskConfigs[planId];
  const random = seededRandom(`${planId}-${participantId}`);
  const distractorBuckets = buildDistractorBuckets(
    config.distractors.map((distractor, index) => ({
      insertAfterCorrectStep: randomChoice(
        DISTRACTOR_INSERT_WINDOWS[index].allowedAfterCorrectSteps,
        random,
      ),
      task: {
        name: config.distractorSteps[index],
        correctOptions: [],
        incorrectOptions: [{
          text: config.distractorSteps[index],
          audioSrc: `/audio/${config.folder}/${config.prefix}_${distractor}.mp3`,
        }],
        mainKind: "incorrect" as const,
      },
    })),
    random,
  );

  return config.correct.flatMap((task, index) => [
    task,
    ...(distractorBuckets.get(index + 1) ?? []),
  ]);
}

function randomChoice<T>(values: T[], random: () => number) {
  return values[Math.floor(random() * values.length)];
}

function buildDistractorBuckets(
  distractors: { insertAfterCorrectStep: number; task: Task }[],
) {
  const buckets = new Map<number, Task[]>();
  for (const distractor of distractors) {
    const bucket = buckets.get(distractor.insertAfterCorrectStep) ?? [];
    bucket.push(distractor.task);
    buckets.set(distractor.insertAfterCorrectStep, bucket);
  }
  return buckets;
}

const plans: Plan[] = [
  {
    id: "training",
    code: "T",
    eyebrow: "TRAINING",
    title: "Training plan",
    description: "Practice the five-step cube training task before the study tasks.",
    tasks: correctTasks(trainingCorrectSteps, "training", "training"),
  },
  {
    id: "sandwich",
    code: "A",
    eyebrow: "WIZARD OF OZ · TASK A",
    title: "Sandwich plan",
    description:
      "Guide the 10-step sandwich preparation with participant-stable distractor instructions.",
    tasks: correctTasks(sandwichCorrectSteps, "sandwich", "sandwich"),
  },
  {
    id: "shelf",
    code: "B",
    eyebrow: "WIZARD OF OZ · TASK B",
    title: "Shelf assembly plan",
    description: "Guide the 10-step shelf assembly with participant-stable distractor instructions.",
    tasks: correctTasks(shelfCorrectSteps, "shelf-assembly", "shelf"),
  },
  {
    id: "boba",
    code: "C",
    eyebrow: "WIZARD OF OZ · TASK C",
    title: "Boba tea plan",
    description: "Guide the 10-step boba tea preparation with participant-stable distractor instructions.",
    tasks: correctTasks(bobaCorrectSteps, "boba", "boba"),
  },
  {
    id: "table",
    code: "D",
    eyebrow: "WIZARD OF OZ · TASK D",
    title: "Table assembly plan",
    description:
      "Guide the 10-step table assembly with participant-stable distractor instructions.",
    tasks: correctTasks(tableCorrectSteps, "table-assembly", "table_assembly"),
  },
];

const STORAGE_KEY = "cogar-control-console-v2";

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatClock(timestamp?: string) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function emptyPlanState(plan: Plan): Record<number, TaskState> {
  return Object.fromEntries(
    plan.tasks.map((_, index) => [index + 1, { audioPlays: 0 }]),
  );
}

function emptyTaskState(): Record<PlanId, Record<number, TaskState>> {
  return Object.fromEntries(
    plans.map((plan) => [plan.id, emptyPlanState(plan)]),
  ) as Record<PlanId, Record<number, TaskState>>;
}

export default function Home() {
  const [participantId, setParticipantId] = useState(1);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous">(
    "next",
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [taskState, setTaskState] =
    useState<Record<PlanId, Record<number, TaskState>>>(emptyTaskState);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sheetSyncUrl, setSheetSyncUrl] = useState(DEFAULT_SHEET_SYNC_URL);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<
    "off" | "ready" | "syncing" | "sent" | "failed"
  >("ready");
  const [playingCue, setPlayingCue] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const selectedPlan = plans[activePlanIndex];
  const activePlan = selectedPlan.id === "sandwich" || selectedPlan.id === "shelf" || selectedPlan.id === "boba" || selectedPlan.id === "table"
    ? { ...selectedPlan, tasks: randomizedStudyTasks(selectedPlan.id, participantId) }
    : selectedPlan;
  const activeState = taskState[activePlan.id] ?? emptyPlanState(activePlan);
  const publishActiveProgress = (currentStep: number) =>
    publishProgress({
      participantId,
      planId: activePlan.id,
      currentStep,
      totalSteps: activePlan.tasks.length,
      updatedAt: new Date().toISOString(),
    }).catch(() => undefined);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    let restored:
      | {
          activePlanIndex?: number;
          startedAt?: number | null;
          completedAt?: number | null;
          participantId?: number;
          sheetSyncUrl?: string;
          taskState?: Record<PlanId, Record<number, TaskState>>;
          logs?: LogEntry[];
        }
      | undefined;

    if (saved) {
      try {
        restored = JSON.parse(saved);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    queueMicrotask(() => {
      if (restored) {
        setActivePlanIndex(
          Math.min(Math.max(restored.activePlanIndex ?? 0, 0), plans.length - 1),
        );
        setStartedAt(restored.startedAt ?? null);
        setCompletedAt(restored.completedAt ?? null);
        if (restored.participantId && restored.participantId >= 1 && restored.participantId <= 36) {
          setParticipantId(restored.participantId);
        }
        if (restored.sheetSyncUrl) {
          setSheetSyncUrl(restored.sheetSyncUrl);
          setSheetSyncStatus("ready");
        }
        setTaskState({
          ...emptyTaskState(),
          ...(restored.taskState ?? {}),
        });
        setLogs(restored.logs ?? []);
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const selected = plans[activePlanIndex];
    const plan = selected.id === "sandwich" || selected.id === "shelf" || selected.id === "boba" || selected.id === "table"
      ? { ...selected, tasks: randomizedStudyTasks(selected.id, participantId) }
      : selected;
    void publishProgress({
      participantId,
      planId: plan.id,
      currentStep: 0,
      totalSteps: plan.tasks.length,
      updatedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }, [activePlanIndex, hydrated, participantId]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activePlanIndex,
        startedAt,
        completedAt,
        participantId,
        sheetSyncUrl,
        taskState,
        logs,
      }),
    );
  }, [activePlanIndex, completedAt, hydrated, logs, participantId, sheetSyncUrl, startedAt, taskState]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const elapsed = startedAt
    ? Math.max(0, Math.floor(((completedAt ?? now) - startedAt) / 1000))
    : 0;
  const recorded = Object.values(activeState).filter((item) => item.decision).length;
  const progress = Math.round((recorded / activePlan.tasks.length) * 100);

  const syncLogToSheet = async (entry: LogEntry) => {
    if (!sheetSyncUrl.trim()) {
      setSheetSyncStatus("off");
      return;
    }

    setSheetSyncStatus("syncing");
    try {
      await fetch(sheetSyncUrl.trim(), {
        method: "POST",
        mode: "no-cors",
        credentials: "include",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          source: "cogar-study-console",
          row: {
            log_id: entry.id,
            participant_id: entry.participantId,
            plan_id: entry.planId,
            plan: entry.planTitle,
            task: entry.task,
            step_name: entry.stepName,
            action: entry.action,
            detail: entry.detail,
            event_timestamp_iso: entry.timestamp,
            elapsed_seconds: entry.elapsed,
            elapsed_label: formatElapsed(entry.elapsed),
          },
        }),
      });
      setSheetSyncStatus("sent");
    } catch {
      setSheetSyncStatus("failed");
    }
  };

  const handleSessionAction = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;

    const isStarting = !startedAt;
    const audio = new Audio(
      `${PUBLIC_BASE_PATH}${
        isStarting
          ? "/audio/session/task_begin.wav"
          : "/audio/session/task_completed.wav"
      }`,
    );
    audio.preload = "auto";
    audio.onended = () => setPlayingCue(null);
    audio.onerror = () => setPlayingCue(null);
    audioRef.current = audio;
    setPlayingCue(isStarting ? "session-start" : "session-complete");
    void audio.play().catch(() => setPlayingCue(null));

    if (isStarting) {
      setStartedAt(new Date().getTime());
      setCompletedAt(null);
    } else {
      if (!completedAt) {
        setCompletedAt(new Date().getTime());
      }
      exportCsv();
    }
  };

  const addLog = (
    planId: PlanId,
    task: number,
    action: string,
    detail: string,
  ) => {
    const timestamp = new Date().toISOString();
    const elapsedAtAction = startedAt
      ? Math.max(
          0,
          Math.floor((new Date().getTime() - startedAt) / 1000),
        )
      : 0;
    const plan = activePlan.id === planId
      ? activePlan
      : plans.find((item) => item.id === planId)!;
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      participantId,
      planId,
      planTitle: plan.title,
      task,
      stepName: plan.tasks[task - 1]?.name ?? `Task ${task}`,
      action,
      detail,
      timestamp,
      elapsed: elapsedAtAction,
    };
    setLogs((current) => [entry, ...current]);
    void syncLogToSheet(entry);
  };

  const updateTask = (
    planId: PlanId,
    taskNumber: number,
    update: (current: TaskState) => TaskState,
  ) => {
    setTaskState((current) => ({
      ...current,
      [planId]: {
        ...current[planId],
        [taskNumber]: update(
          current[planId]?.[taskNumber] ?? { audioPlays: 0 },
        ),
      },
    }));
  };

  const playInstruction = (
    planId: PlanId,
    taskNumber: number,
    option: InstructionOption,
    kind: CueKind,
    optionIndex = 0,
    shouldRecord = true,
    actionLabel?: string,
  ) => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;

    const audio = new Audio(`${PUBLIC_BASE_PATH}${option.audioSrc}`);
    audio.preload = "auto";
    audio.onended = () => setPlayingCue(null);
    audio.onerror = () => setPlayingCue(null);
    audioRef.current = audio;
    setPlayingCue(`${planId}-${taskNumber}-${kind}-${optionIndex}`);
    void audio.play().catch(() => setPlayingCue(null));

    if (shouldRecord) {
      void publishActiveProgress(taskNumber);
      updateTask(planId, taskNumber, (current) => ({
        ...current,
        audioPlays: current.audioPlays + 1,
      }));
      addLog(
        planId,
        taskNumber,
        actionLabel ??
          (kind === "correct"
            ? "Alternative correct option"
            : "Incorrect instruction"),
        option.text,
      );
    }
  };

  const markDecision = (
    planId: PlanId,
    taskNumber: number,
    decision: Decision,
  ) => {
    updateTask(planId, taskNumber, (current) => ({
      ...current,
      decision,
    }));
    addLog(
      planId,
      taskNumber,
      decision === "accept" ? "AI accepted" : "AI rejected",
      "AI instruction decision",
    );
  };

  const goToPlan = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= plans.length) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingCue(null);
    setTurnDirection(nextIndex > activePlanIndex ? "next" : "previous");
    setActivePlanIndex(nextIndex);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;
    if (distance < -60) goToPlan(activePlanIndex + 1);
    if (distance > 60) goToPlan(activePlanIndex - 1);
  };

  const resetSession = () => {
    if (!window.confirm("Reset this session and remove all local records?"))
      return;
    audioRef.current?.pause();
    audioRef.current = null;
    setStartedAt(null);
    setCompletedAt(null);
    setTaskState(emptyTaskState());
    setLogs([]);
    setPlayingCue(null);
    void publishActiveProgress(0);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const handleParticipantIdChange = (nextParticipantId: number) => {
    if (nextParticipantId === participantId) return;

    audioRef.current?.pause();
    audioRef.current = null;
    setParticipantId(nextParticipantId);
    setStartedAt(null);
    setCompletedAt(null);
    setTaskState(emptyTaskState());
    setLogs([]);
    setPlayingCue(null);
  };

  const exportCsv = () => {
    const header = [
      "participant_id",
      "plan",
      "task",
      "step",
      "action",
      "detail",
      "timestamp_iso",
      "elapsed",
    ];
    const rows = [...logs].reverse().map((entry) => {
      const plan = plans.find((item) => item.id === entry.planId)!;
      return [
        entry.participantId,
        entry.planTitle ?? plan.title,
        entry.task,
        entry.stepName ?? plan.tasks[entry.task - 1].name,
        entry.action,
        entry.detail,
        entry.timestamp,
        formatElapsed(entry.elapsed),
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cogar-${new Date().toISOString().slice(0, 19)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sessionLabel = useMemo(() => {
    if (!startedAt) return "Ready";
    if (completedAt) return "Complete";
    return "Live session";
  }, [completedAt, startedAt]);

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            C
          </div>
          <div>
            <p className="eyebrow">RESEARCH CONSOLE</p>
            <h1>
              Cog<span>AR</span>
            </h1>
          </div>
        </div>
        <div className="session-tools">
          <label className="participant-picker">
            <span>Participant ID</span>
            <select
              className="participant-dropdown"
              value={participantId}
              onChange={(event) => handleParticipantIdChange(Number(event.target.value))}
              aria-label="Participant ID"
            >
              {Array.from({ length: 36 }, (_, index) => index + 1).map((id) => (
                <option key={id} value={id}>Participant {String(id).padStart(2, "0")}</option>
              ))}
            </select>
          </label>
          <a
            className="participant-display-link"
            href={`${PUBLIC_BASE_PATH}/progress?participant=${participantId}`}
          >Participant display</a>
          <button
            type="button"
            className={`task-start-button ${
              playingCue ===
              (startedAt ? "session-complete" : "session-start")
                ? "is-playing"
                : ""
            } ${startedAt ? "is-started" : ""}`}
            onClick={handleSessionAction}
            aria-label={
              !startedAt
                ? "Play task start audio and start the session timer"
                : completedAt
                  ? "Replay task complete audio"
                  : "Play task complete audio and stop the session timer"
            }
            title={
              !startedAt
                ? "Play audio and start session timer"
                : completedAt
                  ? "Replay task complete audio"
                  : "Play audio and complete session"
            }
            data-testid={startedAt ? "task-complete" : "task-start"}
          >
            <span aria-hidden="true">{completedAt ? "✓" : "▶"}</span>
            {startedAt ? "Task complete" : "Task start"}
          </button>
          <div className={`live-pill ${startedAt ? "is-live" : ""}`}>
            <span aria-hidden="true" />
            {sessionLabel}
          </div>
          <div
            className="timer"
            aria-label={`Session elapsed time ${formatElapsed(elapsed)}`}
          >
            <small>SESSION TIME</small>
            <strong>{formatElapsed(elapsed)}</strong>
          </div>
          <button className="ghost-button" type="button" onClick={resetSession}>
            Reset session
          </button>
        </div>
      </header>

      <nav className="plan-tabs" aria-label="Task plans">
        {plans.map((plan, index) => (
          <button
            type="button"
            className={index === activePlanIndex ? "is-active" : ""}
            onClick={() => goToPlan(index)}
            aria-current={index === activePlanIndex ? "page" : undefined}
            key={plan.id}
          >
            <span>{plan.code}</span>
            {plan.title}
          </button>
        ))}
        <p>
          {String(activePlanIndex + 1).padStart(2, "0")} /{" "}
          {String(plans.length).padStart(2, "0")}
        </p>
      </nav>

      <div
        className="page-stage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activePlanIndex > 0 && (
          <button
            type="button"
            className="page-arrow page-arrow-previous"
            onClick={() => goToPlan(activePlanIndex - 1)}
            aria-label={`Previous task: ${plans[activePlanIndex - 1].title}`}
            title={`Previous: ${plans[activePlanIndex - 1].title}`}
          >
            ←
          </button>
        )}
        {activePlanIndex < plans.length - 1 && (
          <button
            type="button"
            className="page-arrow page-arrow-next"
            onClick={() => goToPlan(activePlanIndex + 1)}
            aria-label={`Next task: ${plans[activePlanIndex + 1].title}`}
            title={`Next: ${plans[activePlanIndex + 1].title}`}
          >
            →
          </button>
        )}

        <div
          className={`plan-page turn-${turnDirection}`}
          key={activePlan.id}
        >
          <section className="intro">
            <div className="plan-heading">
              <div className="plan-code" aria-hidden="true">
                {activePlan.code}
              </div>
              <div>
                <p className="eyebrow">{activePlan.eyebrow}</p>
                <h2>{activePlan.title}</h2>
                <p className="intro-copy">{activePlan.description}</p>
              </div>
            </div>
            <div className="progress-card">
              <div className="progress-copy">
                <span>Task progress</span>
                <strong>{progress}%</strong>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                {recorded}/{activePlan.tasks.length} decisions recorded
              </p>
            </div>
          </section>

          <section
            className="console-card"
            aria-label={`${activePlan.title} control matrix`}
          >
            <div className="matrix-scroll">
              <div className="matrix" role="table" aria-label="Task control matrix">
                <div className="matrix-header" role="row">
                  <div className="step-heading" role="columnheader">
                    <span>Task sequence &amp; instructions</span>
                    <span className="cue-legend">
                      <span className="legend-correct">Correct</span>
                      <span className="legend-incorrect">Incorrect</span>
                    </span>
                  </div>
                  <div role="columnheader">AI audio</div>
                  <div role="columnheader">Accept</div>
                  <div role="columnheader">Reject</div>
                </div>

                {activePlan.tasks.map((task, index) => {
                  const taskNumber = index + 1;
                  const state = activeState[taskNumber] ?? { audioPlays: 0 };
                  return (
                    <div
                      className={`matrix-row ${state.decision ? "is-complete" : ""}`}
                      role="row"
                      key={`${task.name}-${taskNumber}`}
                    >
                      <div className="task-cell" role="rowheader">
                        <div className="step-number">
                          {String(taskNumber).padStart(2, "0")}
                        </div>
                        <div className="step-copy">
                          <strong>{task.name}</strong>
                          <div className="instruction-cues">
                            {task.correctOptions.map((option, optionIndex) => (
                              <button
                                type="button"
                                className={`cue-button cue-correct is-hint-only ${
                                  playingCue ===
                                  `${activePlan.id}-${taskNumber}-correct-${optionIndex}`
                                    ? "is-playing"
                                    : ""
                                }`}
                                onClick={() =>
                                  playInstruction(
                                    activePlan.id,
                                    taskNumber,
                                    option,
                                    "correct",
                                    optionIndex,
                                    false,
                                  )
                                }
                                aria-label={`Play unlogged instruction preview ${
                                  optionIndex + 1
                                } for task ${taskNumber}: ${
                                  option.text
                                }`}
                                title="Preview only — no timestamp or event log"
                                data-testid={`${activePlan.id}-correct-option-${taskNumber}-${optionIndex}`}
                                key={option.audioSrc}
                              >
                                <span aria-hidden="true">▶</span>
                                {option.text}
                              </button>
                            ))}
                            {task.incorrectOptions?.map(
                              (option, optionIndex) => (
                                <button
                                  type="button"
                                  className={`cue-button cue-incorrect ${
                                    playingCue ===
                                    `${activePlan.id}-${taskNumber}-incorrect-${optionIndex}`
                                      ? "is-playing"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    playInstruction(
                                      activePlan.id,
                                      taskNumber,
                                      option,
                                      "incorrect",
                                      optionIndex,
                                      false,
                                    )
                                  }
                                  aria-label={`Play unlogged incorrect instruction preview ${
                                    optionIndex + 1
                                  } for task ${taskNumber}: ${option.text}`}
                                  title="Preview only — no timestamp or event log"
                                  data-testid={`${activePlan.id}-incorrect-option-${taskNumber}-${optionIndex}`}
                                  key={option.audioSrc}
                                >
                                  <span aria-hidden="true">▶</span>
                                  {option.text}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </div>

                      <div role="cell" className="action-cell">
                        <button
                          type="button"
                          className={`circle-button audio-button ${
                            playingCue ===
                            `${activePlan.id}-${taskNumber}-${task.mainKind}-0`
                              ? "is-playing"
                              : ""
                          }`}
                          onClick={() => {
                            const mainOption =
                              task.mainKind === "correct"
                                ? task.correctOptions[0]
                                : task.incorrectOptions![0];
                            playInstruction(
                              activePlan.id,
                              taskNumber,
                              mainOption,
                              task.mainKind,
                              0,
                              true,
                              "AI audio",
                            );
                          }}
                          aria-label={`Play main AI audio for task ${taskNumber}`}
                          title="Play main AI instruction"
                          data-testid={`${activePlan.id}-audio-${taskNumber}`}
                        >
                          <span className="speaker-icon" aria-hidden="true">
                            ▶
                          </span>
                        </button>
                        <small>
                          {state.audioPlays ? `${state.audioPlays}×` : "Play"}
                        </small>
                      </div>

                      {(["accept", "reject"] as const).map((decision) => {
                        const selected = state.decision === decision;
                        const label = decision === "accept" ? "Accept" : "Reject";
                        return (
                          <div role="cell" className="action-cell" key={decision}>
                            <button
                              type="button"
                              className={`circle-button decision-button decision-${decision} ${
                                selected ? "is-selected" : ""
                              }`}
                              onClick={() =>
                                markDecision(activePlan.id, taskNumber, decision)
                              }
                              aria-label={`${label} AI instruction for task ${taskNumber}`}
                              aria-pressed={selected}
                              title={`${label} AI instruction`}
                              data-testid={`${activePlan.id}-${decision}-${taskNumber}`}
                            >
                              <span aria-hidden="true">{selected ? (decision === "reject" ? "×" : "✓") : ""}</span>
                            </button>
                            <small>{selected ? "Recorded" : label}</small>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="log-card">
        <div className="log-header">
          <div>
            <p className="eyebrow">LOCAL RECORD · ALL TASKS</p>
            <h3>Event log</h3>
          </div>
          <div className="log-actions">
            <span className={`sheet-sync-badge is-${sheetSyncStatus}`}>
              Google Sheets sync · {sheetSyncStatus}
            </span>
            <button
              type="button"
              className="export-button"
              onClick={exportCsv}
              disabled={!logs.length}
            >
              Export CSV
            </button>
          </div>
        </div>
        <label className="sheet-sync-field">
          <span>Google Sheets sync URL</span>
          <input
            value={sheetSyncUrl}
            onChange={(event) => {
              const value = event.target.value;
              setSheetSyncUrl(value);
              setSheetSyncStatus(value.trim() ? "ready" : "off");
            }}
            placeholder="Paste deployed Google Apps Script web app URL"
            aria-label="Google Sheets sync URL"
          />
        </label>
        {logs.length ? (
          <div className="log-list" aria-live="polite">
            {logs.slice(0, 8).map((entry) => {
              const logPlan = plans.find(
                (plan) => plan.id === entry.planId,
              )!;
              return (
                <article className="log-item" key={entry.id}>
                  <div className="log-task">
                    {logPlan.code}
                    {entry.task}
                  </div>
                  <div>
                    <strong>{entry.action}</strong>
                    <p>{entry.detail}</p>
                  </div>
                  <time dateTime={entry.timestamp}>
                    {formatElapsed(entry.elapsed)}
                    <span>{formatClock(entry.timestamp)}</span>
                  </time>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-log">
            <span aria-hidden="true">◎</span>
            <p>AI Audio plays will appear here with timestamps.</p>
          </div>
        )}
      </section>

      <footer>
        <p>Records stay on this device until you reset the session.</p>
        <p>CogAR · Wizard of Oz operator view</p>
      </footer>
    </main>
  );
}
