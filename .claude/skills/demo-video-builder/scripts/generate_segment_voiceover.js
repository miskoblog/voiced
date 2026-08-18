/**
 * Segment-level ElevenLabs TTS — one clip per narration segment, read from
 * each beat's recordings/<beat>/manifest.json (written by record_demo.js).
 * Pairs with assemble_segments.py, which expects exactly this output layout.
 * Also generates the hook beat's clip separately since it has no recorded
 * video/manifest of its own.
 *
 * COPY THIS FILE and set HOOK_TEXT to the real hook narration.
 *
 * RUN: ELEVENLABS_API_KEY=... NODE_USE_ENV_PROXY=1 node generate_segment_voiceover.js [beatName ...]
 * OUTPUT: audio/segments/<beat>/seg-NN.mp3 (+ audio/beat-00-hook.mp3)
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = "REPLACE — an ElevenLabs voice ID, see references/elevenlabs.md";
const RECORDINGS_DIR = path.join(__dirname, "..", "recordings");
const AUDIO_DIR = path.join(__dirname, "..", "audio");

if (!API_KEY) {
  console.error("ELEVENLABS_API_KEY not set");
  process.exit(1);
}

const HOOK_TEXT = "REPLACE — the hook beat's narration, spoken over the still main-product screenshot.";

// 192kbps, NOT the API's 128kbps default. At 128 the codec mangles sibilants
// ("s"/"sh") badly enough that a client flagged the harshness as a defect on a
// real delivery. Don't drop this back to the default to save bytes.
const OUTPUT_FORMAT = "mp3_44100_192";

async function ttsToFile(text, outPath) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      // stability 0.6 rather than 0.5 — the secondary lever on the same
      // sibilance problem the bitrate bump above addresses.
      voice_settings: { stability: 0.6, similarity_boost: 0.75 },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HTTP ${resp.status} — ${errText.slice(0, 300)}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log(`Generated ${outPath} (${buf.length} bytes)`);
}

(async () => {
  const beatFilter = process.argv.slice(2);
  const allBeats = fs
    .readdirSync(RECORDINGS_DIR)
    .filter((d) => fs.existsSync(path.join(RECORDINGS_DIR, d, "manifest.json")));
  const beats = beatFilter.length ? allBeats.filter((b) => beatFilter.includes(b)) : allBeats;

  if (!beatFilter.length || beatFilter.includes("00-hook")) {
    await ttsToFile(HOOK_TEXT, path.join(AUDIO_DIR, "beat-00-hook.mp3"));
  }

  for (const beat of beats) {
    const manifest = JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, beat, "manifest.json")));
    for (const seg of manifest) {
      // seg.text must be the EXACT clause spoken during that segment's on-screen
      // action — this is what keeps voiceover and video in sync per-clause
      // instead of just per-beat (see SKILL.md's sync specification).
      const outPath = path.join(AUDIO_DIR, "segments", beat, `seg-${String(seg.index).padStart(2, "0")}.mp3`);
      await ttsToFile(seg.text, outPath);
    }
  }

  console.log("Done.");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
