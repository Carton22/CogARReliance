#!/usr/bin/env node
// Regenerates the study cue and challenge audio through the OpenAI TTS API.
//
// Usage:
//   OPENAI_API_KEY=... node scripts/generate-tts.mjs            # all clips
//   OPENAI_API_KEY=... node scripts/generate-tts.mjs --only S04 # one clip
//   OPENAI_API_KEY=... node scripts/generate-tts.mjs --list     # print the manifest
//
// The key is read from the environment and never written to disk. Settings match
// the assets generated before this script existed; changing them re-voices the
// study and must not be done casually.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = "gpt-4o-mini-tts";
const VOICE = "nova";
const SPEED = 1.0;
const RESPONSE_FORMAT = "mp3";
const INSTRUCTIONS =
  "Speak in professional way for a presentation in academic paper and user study";

// Must stay identical to CHALLENGE_PREFIXES in app/page.tsx — the app derives the
// sentence it displays from that list, and this script speaks it into the clip.
const CHALLENGE_PREFIXES = [
  "I think it's appropriate to",
  "I checked again, and it is good to",
  "I would suggest you",
  "My recommendation is still to",
];

// Per-plan starting offset into CHALLENGE_PREFIXES, mirroring the arguments the
// app passes to correctTasks(). Training's two calls use offsets 1 and 4, which
// over its six steps is the same as one run of offset 1.
const CHALLENGE_OFFSETS = { training: 1, shelf: 0, boba: 2 };

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Challenge sentence rule: prefix + cue text with its first letter lowercased.
function challenge(text, prefixIndex) {
  const prefix = CHALLENGE_PREFIXES[prefixIndex % CHALLENGE_PREFIXES.length];
  return `${prefix} ${text.charAt(0).toLowerCase()}${text.slice(1)}.`;
}

// Every correct step that has a challenge clip, in the order the app builds them.
// Order matters: the prefix each step gets is CHALLENGE_OFFSETS[plan] + its index.
const CHALLENGE_SOURCES = [
  {
    idPrefix: "T",
    plan: "training",
    steps: [
      ["Put a long piece on the ground", "public/audio/training/training_01_challenge.mp3"],
      ["Put a square piece at slot 1", "public/audio/training/training_02_challenge.mp3"],
      ["Put a square piece at slot 2", "public/audio/training/training_03_challenge.mp3"],
      ["Put a square piece at slot 3", "public/audio/training/training_put_square_slot3_challenge.mp3"],
      ["Put a square piece at slot 4", "public/audio/training/training_put_square_slot4_challenge.mp3"],
      ["Put a long piece on the top", "public/audio/training/training_put_long_piece_top_challenge.mp3"],
    ],
  },
  {
    idPrefix: "S",
    plan: "shelf",
    steps: [
      ["Classify the pieces based on color", "public/audio/shelf-assembly/shelf_01_challenge.mp3"],
      ["Insert side A of a green into slot 1 of the yellow", "public/audio/shelf-assembly/shelf_02_challenge.mp3"],
      ["Insert a pink piece at slot 2 of the yellow", "public/audio/shelf-assembly/shelf_03_challenge.mp3"],
      ["Insert another 2 pink at slot 3 and 4 of the yellow", "public/audio/shelf-assembly/shelf_04_challenge.mp3"],
      ["Insert side A of a green into slot 5 of the yellow", "public/audio/shelf-assembly/shelf_05_challenge.mp3"],
      ["Connect No.2 yellow piece with the greens and pinks", "public/audio/shelf-assembly/shelf_06_challenge.mp3"],
      ["Connect the blue piece with side B of 2 green pieces", "public/audio/shelf-assembly/shelf_07_challenge.mp3"],
    ],
  },
  {
    idPrefix: "B",
    plan: "boba",
    steps: [
      ["Add strawberry sugar syrup into a cup", "public/audio/boba/boba_01_challenge.mp3"],
      ["Add boba", "public/audio/boba/boba_02_challenge.mp3"],
      ["Add strawberry yogurt into the cup", "public/audio/boba/boba_03_challenge.mp3"],
      ["Pour matcha latte into the cup", "public/audio/boba/boba_04_challenge.mp3"],
      ["Pour coconut milk into the cup", "public/audio/boba/boba_05_challenge.mp3"],
      ["Add milk cream on the top", "public/audio/boba/boba_06_challenge.mp3"],
      ["Put a lid on the cup", "public/audio/boba/boba_07_challenge.mp3"],
    ],
  },
];

const MANIFEST = [
  // Content cues — text changes to existing steps, plus one new recovery cue.
  {
    id: "C01",
    text: "Insert another 2 pink at slot 3 and 4 of the yellow",
    path: "public/audio/shelf-assembly/shelf_04.mp3",
  },
  {
    id: "C02",
    text: "Insert side A of a purple piece into slot 3 of the yellow",
    path: "public/audio/shelf-assembly-distractors/shelf_A.mp3",
  },
  {
    id: "C03",
    text: "remove the purple piece at slot 3, because the size doesn't match",
    path: "public/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.mp3",
  },
  {
    id: "C04",
    text: "remove the pink piece at slot 5, because the shape doesn't match",
    path: "public/audio/shelf-assembly-distractors/shelf_remove_pink_slot5.mp3",
  },
  {
    id: "C05",
    text: "Remove the black piece, because the size doesn't match",
    path: "public/audio/shelf-assembly-distractors/shelf_remove_black_piece.mp3",
  },
  {
    id: "C06",
    text: "grab the left bottle to add white sugar",
    path: "public/audio/boba-distractors/boba_A.mp3",
  },
  {
    id: "C07",
    text: "grab the right bottle to add white sugar",
    path: "public/audio/boba-distractors/boba_A_recovery.mp3",
  },
  {
    id: "C08",
    text: "Use a spoon to add matcha powder",
    path: "public/audio/boba-distractors/boba_use_spoon_matcha.mp3",
  },
  {
    id: "C09",
    text: "Insert a white straw",
    path: "public/audio/boba-distractors/boba_insert_white_straw.wav",
  },
  {
    id: "C10",
    text: "Oh, replace the straw with a bigger black straw for boba",
    path: "public/audio/boba-distractors/boba_replace_black_straw.wav",
  },
  {
    id: "C11",
    text: "Connect No.2 yellow piece with the greens and pinks",
    path: "public/audio/shelf-assembly/shelf_06.mp3",
  },
  {
    id: "C12",
    text: "Connect the black piece with side B of 2 green pieces",
    path: "public/audio/shelf-assembly-distractors/shelf_C.mp3",
  },
  {
    id: "C17",
    text: "Connect the blue piece with side B of 2 green pieces",
    path: "public/audio/shelf-assembly/shelf_07.mp3",
  },
  {
    id: "C18",
    text: "Insert side A of a green into slot 1 of the yellow",
    path: "public/audio/shelf-assembly/shelf_02.mp3",
  },
  {
    id: "C19",
    text: "Insert side A of a green into slot 5 of the yellow",
    path: "public/audio/shelf-assembly/shelf_05.mp3",
  },
  {
    id: "C13",
    text: "Add strawberry yogurt into the cup",
    path: "public/audio/boba/boba_03.mp3",
  },
  {
    id: "C14",
    text: "Pour matcha latte into the cup",
    path: "public/audio/boba/boba_04.mp3",
  },
  {
    id: "C15",
    text: "Pour coconut milk into the cup",
    path: "public/audio/boba/boba_05.mp3",
  },
  {
    id: "C16",
    text: "Put a lid on the cup",
    path: "public/audio/boba/boba_07.mp3",
  },
  {
    id: "A01",
    text: "Turn and insert the other side A of the green",
    path: "public/audio/assistive/shelf/turn_green_other_side.wav",
  },
  {
    id: "A17",
    text: "Just connect with No.1 Yellow piece",
    path: "public/audio/assistive/shelf/connect_no1_yellow_piece.wav",
  },
  {
    id: "A02",
    text: "Nice, keep going",
    path: "public/audio/assistive/shelf/nice_keep_going.wav",
  },
  {
    id: "A03",
    text: "should connect with side B of the green pieces",
    path: "public/audio/assistive/shelf/connect_between_yellow_pieces.wav",
  },
  {
    id: "A18",
    text: "Yes",
    path: "public/audio/assistive/task-begin/yes.wav",
  },
  {
    id: "A19",
    text: "No",
    path: "public/audio/assistive/task-begin/no.wav",
  },
  {
    id: "A04",
    text: "Keep adding more",
    path: "public/audio/assistive/boba/keep_adding_more.wav",
  },
  {
    id: "A05",
    text: "Stop",
    path: "public/audio/assistive/boba/stop.wav",
  },
  {
    id: "A06",
    text: "Add a bit more",
    path: "public/audio/assistive/boba/add_a_bit_more.wav",
  },
  {
    id: "A07",
    text: "You can stop now",
    path: "public/audio/assistive/boba/you_can_stop_now.wav",
  },
  {
    id: "A08",
    text: "You can add all of them",
    path: "public/audio/assistive/boba/you_can_add_all.wav",
  },
  {
    id: "A20",
    text: "add half of them",
    path: "public/audio/assistive/boba/add_half_of_them.mp3",
  },
  {
    id: "A09",
    text: "Add more",
    path: "public/audio/assistive/boba/add_more.wav",
  },
  {
    id: "A10",
    text: "Stop adding",
    path: "public/audio/assistive/boba/stop_adding.wav",
  },
  {
    id: "A11",
    text: "Keep pouring",
    path: "public/audio/assistive/boba/keep_pouring.wav",
  },
  {
    id: "A12",
    text: "Stop now",
    path: "public/audio/assistive/boba/stop_now.wav",
  },
  {
    id: "A13",
    text: "You can add more",
    path: "public/audio/assistive/boba/you_can_add_more.wav",
  },
  {
    id: "A14",
    text: "Enough now",
    path: "public/audio/assistive/boba/enough_now.wav",
  },
  {
    id: "A15",
    text: "Stop pouring",
    path: "public/audio/assistive/boba/stop_pouring.wav",
  },
  {
    id: "A16",
    text: "Good now",
    path: "public/audio/assistive/boba/good_now.wav",
  },

  // Challenge cues — one per correct step, built from CHALLENGE_SOURCES below
  // so the prefix rotation can never drift from the app's.
  ...CHALLENGE_SOURCES.flatMap(({ idPrefix, plan, steps }) =>
    steps.map(([text, path], index) => ({
      id: `${idPrefix}${String(index + 1).padStart(2, "0")}`,
      text: challenge(text, CHALLENGE_OFFSETS[plan] + index),
      path,
    })),
  ),
];

function isMp3(bytes) {
  if (bytes.length < 3) return false;
  const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const isFrameSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return isId3 || isFrameSync;
}

async function generate(entry, apiKey) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      speed: SPEED,
      response_format: RESPONSE_FORMAT,
      instructions: INSTRUCTIONS,
      input: entry.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${entry.id} failed: HTTP ${response.status} ${detail}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isMp3(bytes)) {
    throw new Error(`${entry.id} returned data that is not an MP3 stream`);
  }

  const destination = resolve(repoRoot, entry.path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return bytes.length;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    for (const entry of MANIFEST) {
      console.log(`${entry.id}\t${entry.path}\t${entry.text}`);
    }
    return;
  }

  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex === -1 ? null : args[onlyIndex + 1];
  if (onlyIndex !== -1 && !only) {
    throw new Error("--only requires a manifest id");
  }
  const queue = only
    ? MANIFEST.filter((entry) => entry.id === only)
    : MANIFEST;

  if (only && queue.length === 0) {
    throw new Error(`No manifest entry with id ${only}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  let failures = 0;
  for (const entry of queue) {
    try {
      const size = await generate(entry, apiKey);
      console.log(`ok   ${entry.id}  ${size} bytes  ${entry.path}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${entry.id}  ${error.message}`);
    }
  }

  console.log(`\n${queue.length - failures}/${queue.length} clips written`);
  if (failures > 0) process.exitCode = 1;
}

await main();
