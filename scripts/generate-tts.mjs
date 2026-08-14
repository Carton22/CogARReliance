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

const CHALLENGE_PREFIX = "I think it's appropriate to";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Challenge sentence rule: prefix + cue text with its first letter lowercased.
function challenge(text) {
  return `${CHALLENGE_PREFIX} ${text.charAt(0).toLowerCase()}${text.slice(1)}.`;
}

const MANIFEST = [
  // Content cues — text changes to existing steps, plus one new recovery cue.
  {
    id: "C01",
    text: "Insert another 2 pink at slot 3 and 4 of the yellow",
    path: "public/audio/shelf-assembly/shelf_04.mp3",
  },
  {
    id: "C02",
    text: "Insert a purple piece at slot 3 of the yellow",
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
    text: "add a little white sugar from the bottle on your left",
    path: "public/audio/boba-distractors/boba_A.mp3",
  },
  {
    id: "C07",
    text: "add a little white sugar from the bottle on your right",
    path: "public/audio/boba-distractors/boba_A_recovery.mp3",
  },
  {
    id: "C08",
    text: "Use a spoon to add matcha powder",
    path: "public/audio/boba-distractors/boba_use_spoon_matcha.mp3",
  },
  {
    id: "C09",
    text: "Add a piece of lemon on the edge of the cup",
    path: "public/audio/boba-distractors/boba_C.mp3",
  },
  {
    id: "C10",
    text: "Oh, please remove the lemon piece, because it's for delivery",
    path: "public/audio/boba-distractors/boba_remove_lemon.mp3",
  },

  // Challenge cues — training plan.
  {
    id: "T01",
    text: challenge("Put a long piece on the ground"),
    path: "public/audio/training/training_01_challenge.mp3",
  },
  {
    id: "T02",
    text: challenge("Put a square piece at slot 1"),
    path: "public/audio/training/training_02_challenge.mp3",
  },
  {
    id: "T03",
    text: challenge("Put a square piece at slot 2"),
    path: "public/audio/training/training_03_challenge.mp3",
  },
  {
    id: "T04",
    text: challenge("Put a square piece at slot 3"),
    path: "public/audio/training/training_put_square_slot3_challenge.mp3",
  },
  {
    id: "T05",
    text: challenge("Put a square piece at slot 4"),
    path: "public/audio/training/training_put_square_slot4_challenge.mp3",
  },
  {
    id: "T06",
    text: challenge("Put a long piece on the top"),
    path: "public/audio/training/training_put_long_piece_top_challenge.mp3",
  },

  // Challenge cues — shelf assembly plan.
  {
    id: "S01",
    text: challenge("Classify the pieces based on color"),
    path: "public/audio/shelf-assembly/shelf_01_challenge.mp3",
  },
  {
    id: "S02",
    text: challenge("Insert a green at slot 1 of the yellow"),
    path: "public/audio/shelf-assembly/shelf_02_challenge.mp3",
  },
  {
    id: "S03",
    text: challenge("Insert a pink piece at slot 2 of the yellow"),
    path: "public/audio/shelf-assembly/shelf_03_challenge.mp3",
  },
  {
    id: "S04",
    text: challenge("Insert another 2 pink at slot 3 and 4 of the yellow"),
    path: "public/audio/shelf-assembly/shelf_04_challenge.mp3",
  },
  {
    id: "S05",
    text: challenge("Insert a green piece at slot 5"),
    path: "public/audio/shelf-assembly/shelf_05_challenge.mp3",
  },
  {
    id: "S06",
    text: challenge("Connect another yellow with the green and pink"),
    path: "public/audio/shelf-assembly/shelf_06_challenge.mp3",
  },
  {
    id: "S07",
    text: challenge("Connect a blue piece with the 2 green"),
    path: "public/audio/shelf-assembly/shelf_07_challenge.mp3",
  },

  // Challenge cues — boba tea plan.
  {
    id: "B01",
    text: challenge("Add strawberry sugar syrup into a cup"),
    path: "public/audio/boba/boba_01_challenge.mp3",
  },
  {
    id: "B02",
    text: challenge("Add boba"),
    path: "public/audio/boba/boba_02_challenge.mp3",
  },
  {
    id: "B03",
    text: challenge("Add the yogurt as bottom layer"),
    path: "public/audio/boba/boba_03_challenge.mp3",
  },
  {
    id: "B04",
    text: challenge("Pour matcha latte"),
    path: "public/audio/boba/boba_04_challenge.mp3",
  },
  {
    id: "B05",
    text: challenge("Pour coconut milk"),
    path: "public/audio/boba/boba_05_challenge.mp3",
  },
  {
    id: "B06",
    text: challenge("Add milk cream on the top"),
    path: "public/audio/boba/boba_06_challenge.mp3",
  },
  {
    id: "B07",
    text: challenge("Put the lid on the cup"),
    path: "public/audio/boba/boba_07_challenge.mp3",
  },
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
