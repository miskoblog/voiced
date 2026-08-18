# ElevenLabs voiceover — API usage

**Security first, every time this skill runs**: ask the user for an ElevenLabs
**API key**, never a login/password. If they offer login credentials instead
(it happened once — the user offered account login before this doc existed),
decline and explain why: a key can be scoped to text-to-speech only and revoked
independently of their password; a shared login can't be scoped or cleanly
revoked at all. They generate one at elevenlabs.io under their profile icon →
**API Keys**.

Handle the key as a runtime value only:
- Never write it into a file that gets committed to any repo.
- Never print it back in full in chat (fine to confirm "got a key starting with
  `sk_...`" if useful, never the whole thing).
- If it needs to reach a script, pass it as an environment variable at
  invocation time (`ELEVENLABS_API_KEY=... node script.js`), not hardcoded.

**This specific API hasn't been live-tested while building this skill** (no key
was available) — everything below is from ElevenLabs' documented, stable REST
API, which is a fair bit more mature/unlikely-to-have-changed than most, but
still: generate one short test line first and confirm the output plays back
correctly and sounds right before generating the whole script's worth of audio.
Don't find out something's wrong after 15 clips.

## List available voices

```bash
curl -s https://api.elevenlabs.io/v1/voices \
  -H "xi-api-key: $ELEVENLABS_API_KEY" | python3 -m json.tool
```

Each entry has a `voice_id` and `name` — show the user a short list of names so
they can pick one (or ask them to name a voice they already use in their
account). If they have no preference, a stock voice like "Rachel" or "Adam" (the
commonly-available defaults on most accounts) is a safe fallback — but confirm
the exact `voice_id` from the actual `/v1/voices` response rather than assuming
a name maps to a specific ID, since that can vary by account.

## Generate one line of narration

```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_192" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The exact narration line for this beat.",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": { "stability": 0.6, "similarity_boost": 0.75 }
  }' \
  --output beat-01.mp3
```

- **`output_format=mp3_44100_192` is required, not optional.** The API's own
  default is 128kbps MP3, which compresses sibilants ("s", "sh", "t") harshly
  enough that it shipped as a client-noticeable defect on a real delivery — the
  narration sounded hissy and cheap on exactly the consonants speech is most
  sensitive on. 192 fixes it. Always pass this query param; never rely on the
  default. `scripts/generate_segment_voiceover.js` already does.
- **`stability: 0.6`, not 0.5** — the secondary lever on the same sibilance
  problem. Slightly steadier delivery, less spiky high-frequency energy. These
  two changes together were the whole fix; nothing else in `voice_settings`
  needed touching, so don't go re-tuning `similarity_boost` speculatively.
- `model_id`: `eleven_multilingual_v2` is a safe general default (good quality,
  handles punctuation/pacing well). `eleven_turbo_v2` is faster/cheaper if the
  user is generating a lot of iterations and quality-per-cent matters less
  during drafting — ask if they have a preference, otherwise default to the
  multilingual model for the final pass.
- Output is raw MP3 bytes written directly to the `--output` file — no JSON
  wrapper, so don't try to parse the response as JSON on success. A JSON body
  in the response means an error (bad key, bad voice_id, quota, etc.) — check
  `file <output>` after the call; if it says "ASCII text" instead of "MPEG ADTS"
  or similar, the call failed and the file contains an error message, not audio.

## One clip per script beat, not one giant call

Generate a separate audio file per beat/line from the shot list (`beat-01.mp3`,
`beat-02.mp3`, ...), matching the numbering used for the screen-recording clips.
This is what lets Phase 6 (assembly) pad each video segment to its exact paired
voiceover length instead of guessing at timing for one long block.

## Getting each clip's duration (needed for Phase 6 padding)

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 beat-01.mp3
```

Feed that duration into the video-padding step in `ffmpeg-cookbook.md`.
