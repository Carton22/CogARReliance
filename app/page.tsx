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
type PlanId = "sandwich" | "shelf" | "boba" | "table";
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

const shelfCorrectSteps = [
  "Classify the pieces based on color",
  "Take a yellow piece",
  "Take a green piece",
  "Insert a green piece at slot 1 of the yellow piece",
  "Take a pink piece",
  "Insert a pink piece at slot 2 of the yellow piece",
  "Insert another pink piece at slot 3 of the yellow piece",
  "Insert another pink piece at slot 4 of the yellow piece",
  "Take a green piece",
  "Align the orientations of the 2 green pieces",
  "Insert a green piece at slot 5 of the yellow piece",
  "Take a yellow piece",
  "Insert another yellow piece on the right of green and pink pieces mirroring the 1st yellow panel.",
  "Take a blue piece",
  "Insert a blue piece with green and pink pieces",
];

const bobaCorrectSteps = [
  "Take a cup",
  "Add strawberry sugar syrup into the cup",
  "Add boba into the cup",
  "Mix boba with the syrup",
  "Add the yogurt into the cup as a bottom layer",
  "Take a new cup",
  "Pour the matcha latte into the new cup",
  "Pour coconut milk into the matcha latte",
  "Mix up the matcha and the coconut milk",
  "Pour mixed matcha milk into the 1st cup",
  "Throw away the 2nd cup",
  "Grab the milk cream",
  "Add cream on top of the 1st cup",
  "Add matcha powder",
  "Add a straw",
];

const tableCorrectSteps = [
  "Insert a number four piece at slot one of a number three piece",
  "Connect the other side of the number four piece with a new number three piece",
  "Take another number four piece",
  "Insert the number four piece at slot two between the two number three pieces",
  "Connect the number one piece on top of the two number three pieces",
  "Connect a number two piece at the remaining slot of the number one piece",
  "Connect a number five piece with a number six piece",
  "Connect another number five piece with the number six piece",
  "Connect a second number six piece on the other end of the number five pieces",
  "Connect a number eight piece with a number nine piece",
  "Connect another number eight piece with the number nine piece",
  "Connect a second number nine piece on the other end of the number eight pieces",
  "Connect a number five piece with a number six piece",
  "Connect another number five piece with the number six piece",
  "Connect a second number six piece on the other end of the number five pieces",
];

const shelfDistractorSteps = [
  "Take a scissors",
  "Insert a purple piece at slot 3",
  "Insert a pink piece at slot 5",
  "Take a black piece",
  "Take a marker pen",
];

const bobaDistractorSteps = [
  "Add white sugar to the cup",
  "Take one more plate",
  "Put a piece of lemon on the edge of the cup",
  "Pour out 25% portion of the first cup into the trash can",
  "Stir the cup",
];

const tableDistractorSteps = [
  "Insert a number seven piece at slot two of a number three piece",
  "Take a number seven piece",
  "Connect a number five piece with a number nine piece",
  "Connect a number six piece with a number eight piece",
  "Take a cutting knife",
];

const randomizedTaskConfigs = {
  shelf: {
    correct: correctTasks(shelfCorrectSteps, "shelf-assembly", "shelf"),
    distractorSteps: shelfDistractorSteps,
    folder: "shelf-assembly-distractors",
    prefix: "shelf",
    distractors: ["A", "B", "C", "D", "E"],
  },
  boba: {
    correct: correctTasks(bobaCorrectSteps, "boba", "boba"),
    distractorSteps: bobaDistractorSteps,
    folder: "boba-distractors",
    prefix: "boba",
    distractors: ["A", "B", "C", "D", "E"],
  },
  table: {
    correct: correctTasks(tableCorrectSteps, "table-assembly", "task_assembly"),
    distractorSteps: tableDistractorSteps,
    folder: "table-assembly-distractors",
    prefix: "task_assembly",
    distractors: ["A", "B", "C", "D", "E"],
  },
} satisfies Record<
  "shelf" | "boba" | "table",
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
  planId: "shelf" | "boba" | "table",
  participantId: number,
) {
  const config = randomizedTaskConfigs[planId];
  const random = seededRandom(`${planId}-${participantId}`);

  return Array.from({ length: 5 }, (_, blockIndex) => {
    const block = config.correct.slice(blockIndex * 3, blockIndex * 3 + 3);
    const position = blockIndex === 0
      ? 1 + Math.floor(random() * 3)
      : Math.floor(random() * 4);
    const distractor = config.distractors[blockIndex];
    const text = config.distractorSteps[blockIndex];
    const wrong: Task = {
      name: text,
      correctOptions: [],
      incorrectOptions: [{
        text,
        audioSrc: `/audio/${config.folder}/${config.prefix}_${distractor}.mp3`,
      }],
      mainKind: "incorrect",
    };
    return [...block.slice(0, position), wrong, ...block.slice(position)];
  }).flat();
}

const plans: Plan[] = [
  {
    id: "sandwich",
    code: "A",
    eyebrow: "WIZARD OF OZ · TASK A",
    title: "Sandwich plan",
    description:
      "Choose a blue alternative correct option or a red incorrect instruction, mark the participant's final act, then classify their reliance.",
    tasks: [
      {
        name: "Bread",
        correctOptions: [
          {
            text: "Take a piece of bread and put in a plate.",
            audioSrc: "/audio/sandwich/step01_main_take_bread.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Ketchup",
        correctOptions: [
          {
            text: "Add ketchup",
            audioSrc: "/audio/sandwich/step02_alt_add_ketchup.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Add ketchup and lemon pieces",
            audioSrc:
              "/audio/sandwich/step02_main_add_ketchup_lemon_pieces.wav",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Cheese",
        correctOptions: [
          {
            text: "Add a piece of cheese.",
            audioSrc: "/audio/sandwich/step03_main_add_cheese.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Ham",
        correctOptions: [
          {
            text: "Add a piece of ham.",
            audioSrc: "/audio/sandwich/step04_main_add_ham.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Bread",
        correctOptions: [
          {
            text: "Add bread",
            audioSrc: "/audio/sandwich/step05_alt_add_bread.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Put celery into this and add bread",
            audioSrc:
              "/audio/sandwich/step05_main_put_celery_add_bread.wav",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Microwave",
        correctOptions: [
          {
            text: "Put into microwave.",
            audioSrc: "/audio/sandwich/step06_main_put_microwave.mp3",
          },
        ],
        mainKind: "correct",
      },
    ],
  },
  {
    id: "shelf",
    code: "B",
    eyebrow: "WIZARD OF OZ · TASK B",
    title: "Shelf assembly plan",
    description: "Guide the 15-step shelf assembly and record the participant's decision for every AI instruction.",
    tasks: correctTasks(shelfCorrectSteps, "shelf-assembly", "shelf"),
  },
  {
    id: "boba",
    code: "C",
    eyebrow: "WIZARD OF OZ · TASK C",
    title: "Boba tea plan",
    description: "Guide the 15-step boba tea preparation and record the participant's decision for every AI instruction.",
    tasks: correctTasks(bobaCorrectSteps, "boba", "boba"),
    /*
      {
        name: "Take a cup",
        correctOptions: [
          {
            text: "Take an empty cup and put in front of you",
            audioSrc:
              "/audio/strawberry-matcha-drink/step01_main_take_cup.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Add strawberry sugar syrup",
        correctOptions: [
          {
            text: "Add strawberry sugar syrup into the cup",
            audioSrc:
              "/audio/strawberry-matcha-drink/step02_main_add_strawberry_syrup.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Add boba and coat every pearl",
        correctOptions: [
          {
            text: "Add boba",
            audioSrc:
              "/audio/strawberry-matcha-drink/step03_alt_add_boba.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Add boba and a few peppers",
            audioSrc:
              "/audio/strawberry-matcha-drink/step03_main_add_boba_peppers.wav",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Add strawberry yogurt as a bottom layer",
        correctOptions: [
          {
            text: "Add strawberry yogurt as the bottom layer",
            audioSrc:
              "/audio/strawberry-matcha-drink/step04_main_add_strawberry_yogurt.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Take a second cup",
        correctOptions: [
          {
            text: "Take a second empty cup",
            audioSrc:
              "/audio/strawberry-matcha-drink/step05_main_take_second_cup.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Mix matcha latte and coconut milk in the 2nd cup",
        correctOptions: [
          {
            text: "Mix matcha latte and coconut milk in the 2nd cup",
            audioSrc:
              "/audio/strawberry-matcha-drink/step06_mix_matcha_latte_coconut_milk.wav",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Pour into the first cup as the 2nd layer",
        correctOptions: [
          {
            text: "Pour into the first cup as the 2nd layer",
            audioSrc:
              "/audio/strawberry-matcha-drink/step07_main_pour_second_layer.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Pour cream on the top of the first cup",
        correctOptions: [
          {
            text: "Pour in the cream on top as 3rd layer",
            audioSrc:
              "/audio/strawberry-matcha-drink/step08_alt_matcha_third_layer.wav",
          },
        ],
        incorrectOptions: [
          {
            text: "Pour in the matcha cream and stir until evenly mixed.",
            audioSrc:
              "/audio/strawberry-matcha-drink/step08_main_pour_matcha_stir.wav",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Add matcha powder on top",
        correctOptions: [
          {
            text: "Add matcha powder on the top",
            audioSrc:
              "/audio/strawberry-matcha-drink/step09_main_add_matcha_powder.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Add a straw and taste",
        correctOptions: [
          {
            text: "Add a straw and have a taste",
            audioSrc:
              "/audio/strawberry-matcha-drink/step10_main_add_straw.mp3",
          },
        ],
        mainKind: "correct",
      },
    ],
  },
  */
  },
  {
    id: "table",
    code: "D",
    eyebrow: "WIZARD OF OZ · TASK D",
    title: "Table assembly plan",
    description:
      "Guide the 15-step table assembly and record the participant's decision for every AI instruction.",
    tasks: correctTasks(tableCorrectSteps, "table-assembly", "task_assembly"),
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
  const activePlan = selectedPlan.id === "shelf" || selectedPlan.id === "boba" || selectedPlan.id === "table"
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
    const plan = selected.id === "shelf" || selected.id === "boba" || selected.id === "table"
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
