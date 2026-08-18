# ffmpeg cookbook — verified commands

Every command below was actually run while building this skill, on a synthetic
test video + tone (standing in for a real screen recording + voiceover clip),
with output checked via `ffprobe` — not copied from documentation unverified.
Real inputs will behave the same way; these are standard, stable ffmpeg
features, not edge-case-prone ones.

Install first if not already done (see `SKILL.md` Phase 3 — the `apt-get
update` step matters, don't skip it).

## The core problem this cookbook solves

A screen-recording clip and its paired voiceover clip are almost never the same
length. Usually the voiceover runs *longer* than the on-screen action (people
talk slower than a UI responds). The fix is to **freeze the video's last frame**
to stretch it to match the audio — never speed up or slow down the voiceover to
fit the video, and don't loop the whole clip (looks like a glitch). Do this
per-beat, before concatenating anything.

## 0. Mix a click sound into the voiceover at logged click moments

If Phase 4 recording logged click timestamps (`clicks.json` per segment/beat —
see `scripts/record_demo.js`), do this FIRST, before padding/muxing, since
every later step treats the clip's audio as one file. Synthesize a short click
rather than sourcing one (no licensing question, no external fetch needed): a
~40ms sine burst with a fast fade reads as a soft UI tick —

```bash
ffmpeg -f lavfi -i "sine=frequency=1200:duration=0.04" -af \
  "afade=t=in:d=0.005,afade=t=out:st=0.02:d=0.02,volume=0.35" click.wav
```

Then build an `adelay`+`amix` filter graph — one delayed copy of `click.wav`
per logged timestamp (`adelay=<ms>:all=1`), mixed onto the voiceover with
`amix=inputs=<n+1>:duration=first:normalize=0`:

```bash
ffmpeg -y -i voice.mp3 -i click.wav -i click.wav -filter_complex \
  "[1:a]adelay=1200:all=1[d1];[2:a]adelay=3400:all=1[d2];[0:a][d1][d2]amix=inputs=3:duration=first:normalize=0[aout]" \
  -map "[aout]" -c:a mp3 voice_with_clicks.mp3
```

`normalize=0` matters — the default halves the voice volume per extra input.
`duration=first` keeps the output length pinned to the voiceover track, not
whichever input happens to be longest. A clip with no logged clicks just
passes its voiceover through unchanged (copy the file, skip the filter).

## 1. Get each clip's duration

```bash
# Timing anything against PICTURE (fades, trims, pads) — probe the video STREAM:
ffprobe -v error -select_streams v -show_entries stream=duration -of csv=p=0 clip.mp4

# Audio-only files (voiceover clips):
ffprobe -v error -select_streams a -show_entries stream=duration -of csv=p=0 voice.mp3

# Container duration — logging and eyeballing only, never for timing:
ffprobe -v error -show_entries format=duration -of csv=p=0 clip.mp4
```

**Gotcha — a container's reported duration is not the video stream's real
duration.** On a muxed beat `final.mp4` the container routinely reports ~0.1s
longer than the video stream, because the audio track runs slightly past the
last video frame. Compute a `fade`/`xfade` offset from `format=duration` and it
can land *after* the final frame, which silently degrades or completely kills
the transition — no error, no warning, just a join that renders as a hard cut.
This cost a full debugging round on a real build. Any time a number is going to
be used to time something against picture, probe `-select_streams v
-show_entries stream=duration`. (`assemble_segments.py` enforces this split:
`vdur()` / `adur()` for timing, `container_dur()` for progress lines only, and
`vdur()` raises rather than quietly falling back to the container value.)

## 2. Pad video to match voiceover length (freeze last frame)

If voiceover is longer than the video by `N` seconds:

```bash
ffmpeg -y -i clip.mp4 -vf "tpad=stop_mode=clone:stop_duration=N" \
  -c:v libx264 -pix_fmt yuv420p clip_padded.mp4
```

`tpad=stop_mode=clone` repeats (freezes) the last frame for `stop_duration`
seconds — confirmed this produces exactly the right total duration (tested:
3s clip + 2s pad = 5.000000s output, matched a 5.04s voiceover closely enough
to not be noticeable).

If the video is instead *longer* than the voiceover (rarer, but happens for a
beat with a lot of on-screen action and little narration), pad the **audio**
with silence instead of trimming the video:

```bash
ffmpeg -y -i voice.mp3 -af "apad=pad_dur=N" -c:a mp3 voice_padded.mp3
```

## 3. Mux the (now-matched-length) video and audio for one beat

```bash
ffmpeg -y -i clip_padded.mp4 -i voice.mp3 -c:v copy -c:a aac -shortest beat_final.mp4
```

`-shortest` is a safety net (stops at the shorter stream) — with correct
padding from step 2 this shouldn't matter, but costs nothing to include.

## 4. Concatenate segments within a beat (hard cut)

If a beat is built from multiple recorded segments (see "Segment-level
recording & assembly" below), concatenate them with a hard cut — it's the
same continuous screen throughout a beat, no transition is needed *within*
one.

**Use `filter_complex concat`, not the concat demuxer, unless every clip has
byte-identical codec parameters.** The concat demuxer with `-c copy` is faster
but requires exact stream compatibility; it worked in testing with two copies
of the same file but threw a "Non-monotonic DTS" warning even in that trivial
case — harmless there, but a real warning sign of fragility with mixed
real-world clips (different resolutions from a resize, different frame
patterns from different amounts of on-screen action, etc.). The
`filter_complex` version re-encodes and handles mismatched inputs correctly:

```bash
ffmpeg -y -i seg1.mp4 -i seg2.mp4 -i seg3.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" -c:v libx264 -pix_fmt yuv420p -c:a aac beat_final.mp4
```

Extend the pattern for however many segments there are: list every input with
`-i`, chain `[N:v][N:a]` for each in the filter, set `n=<count>`. Confirmed
correct total duration for a 2-clip join (5s + 5s → 10.03s, i.e. exactly right).

## 4b. Transition BETWEEN beats — dip through a colour, never a crossfade

Every beat-to-beat boundary gets a transition (hard cuts between beats read as
choppy), including into the hook and out of the closing beat. But **do not use
`xfade`/`acrossfade` for it.** That was the original approach here and it was
abandoned after a real client delivery for three independent reasons, each of
which is enough on its own:

1. **`xfade` chains silently break past the first join.** Eight beats chained as
   7 `xfade` + `acrossfade` pairs in one `filter_complex` rendered *only the
   first* transition as a real blend. Every later join computed a
   mathematically-correct `offset` and still came out a hard cut — no error, no
   warning, just wrong output that looks fine until someone watches it.
2. **A cross-dissolve is invisible in this architecture by construction.** Each
   beat's `setup()` deliberately re-primes the app to the state the previous beat
   ended on, so the frames either side of a join are frequently near-identical.
   Dissolving frame A into a copy of frame A looks like nothing happened.
3. **Overlapping two narration clips sounds bad.** `acrossfade` between two
   unrelated speech waveforms produced an audible volume dip mid-transition
   regardless of which curve was used.

**The sanctioned approach: fade each clip out to a colour and the next one in
from it, sequentially, then hard-concat.** Nothing overlaps — video dips to the
colour and back, audio dips to silence and back, so only one voice is ever
audible. Per clip:

```bash
# Outgoing clip: fade picture out to the colour, audio out to silence.
# H = 0.4 (per side), VDUR = video-STREAM duration (see section 1's gotcha).
ffmpeg -y -i beatN.mp4 \
  -vf "fade=t=out:st=$(echo "$VDUR-0.4"|bc):d=0.4:color=0x0F1115,setsar=1" \
  -af "afade=t=out:st=$(echo "$ADUR-0.4"|bc):d=0.4" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac dipN.mp4

# Incoming clip: fade picture in from the colour, audio in from silence.
ffmpeg -y -i beatN1.mp4 \
  -vf "fade=t=in:st=0:d=0.4:color=0x0F1115,setsar=1" \
  -af "afade=t=in:st=0:d=0.4" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac dipN1.mp4

# Then a plain hard concat of the faded clips (no overlap to compute):
ffmpeg -y -i dipN.mp4 -i dipN1.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" -c:v libx264 -pix_fmt yuv420p -c:a aac final.mp4
```

Middle beats get both fades in one `-vf`/`-af` chain; the first beat gets only
the fade-out, the last only the fade-in.

- **`d=0.4` per side** is the verified length — reads as a deliberate dip
  without feeling like the video is lagging.
- **The colour is a choice, not a constant.** `xfade=transition=fadeblack` was
  tried first and the client found it too harsh. Default to the app's own CSS
  background token (its `--bg` value) so the dip reads as the app's own ground,
  and ask the user if they'd prefer something else. Keep it in one named
  constant — `FADE_COLOR` in `assemble_segments.py` — never inline it per call.
  Prefer ffmpeg's `0xRRGGBB` form over `#RRGGBB`: both parse identically, but
  `#` starts a comment if a command gets pasted into a shell unquoted.
- **`setsar=1` on every clip that goes through a `fade`, without exception.** A
  clip built from a scaled/cropped still (the hook beat) can emerge from a fade
  with a non-1:1 SAR — `12325:12327` on a real run — and the concat then fails
  with the cryptic "Input link parameters do not match". Normalising every clip,
  including ones that got no fade, makes the mismatch impossible.
- **No cumulative arithmetic.** Each clip's fade is timed off its own measured
  duration, so there is no running offset to drift — the other half of why the
  chained version was fragile.
- **If you ever do reach for `xfade` anyway** (some other transition style the
  user specifically asks for): never put more than **2** inputs in one
  `filter_complex`, and fold pairwise, materialising each intermediate to disk
  and re-probing the intermediate's real duration from the file rather than
  accumulating arithmetic. That was confirmed reliable across all 7 joins where
  the single-graph version was not. It's a hard rule, not a caution.
- Scripted and verified in `scripts/assemble_segments.py`'s
  `dip_transition_concat()` — use it rather than hand-rolling the above.

## Segment-level recording & assembly

If Phase 4 used the per-segment isolated recording architecture (see
`scripts/record_demo.js`'s file header for why this is the default, not an
edge case), each segment needs its OWN pass through steps 0-3 above before
concatenation:

1. **Trim the invisible-but-actually-visible prefix first.** `recordVideo`
   captures from browser-context creation, so a segment's webm includes its
   setup + silent state-replay before the segment's own action starts —
   `record_demo.js` logs this boundary as `visibleStart` in each segment's
   `clicks.json`. Trim it off before anything else:
   ```bash
   ffmpeg -y -i segment.webm -ss VISIBLE_START -r 25 -c:v libx264 -pix_fmt yuv420p -an segment_trimmed.mp4
   ```
   Skipping this is the single most common way a segment-based recording ships
   with a jarring "extra clip playing before the narration even starts"
   defect — it looks like an editing mistake because it effectively is one.
2. **Rebase click timestamps** by the same amount — `click_time - visible_start`
   for every logged click — before step 0's click-sound mix.
3. Mix the click sound in (step 0), pad video/audio to match (steps 1-2), mux
   (step 3) — same as any other clip.
4. Concatenate all of one beat's segments hard-cut (step 4) — they're the same
   continuous screen.
5. Crossfade all beats together (step 4b) — see above.

## 5. Captions

**Burned-in** (simplest, always renders correctly everywhere, can't be toggled
off by the viewer):

```bash
ffmpeg -y -i final.mp4 -vf "drawtext=text='Exact caption text':fontcolor=white:fontsize=28:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=h-60" \
  -c:a copy final_captioned.mp4
```

Confirmed working: produces valid h264+aac output with white-on-black-box text
centered near the bottom. Adjust `fontsize`/`y` for the app's actual video
resolution — the values above assume roughly 640–1280px wide footage; scale up
proportionally for a 1920px-wide recording. For per-beat captions matching the
narration exactly, apply `drawtext` to each beat clip in step 3 (before muxing)
rather than one caption for the whole final video, unless the intent is a
single persistent title/lower-third.

**Sidecar `.srt`** (viewer can toggle on/off, needed if uploading somewhere that
displays its own caption track): write a standard SRT file with timestamps
derived from each beat's cumulative start time and duration (from step 1's
`ffprobe` durations), then either mux it as a subtitle stream
(`-i captions.srt -c:s mov_text` for MP4) or hand it to the user as a separate
file alongside the video, depending on where it's being hosted.

## 6. Final export settings

H.264 video + AAC audio in an MP4 container (`-c:v libx264 -pix_fmt yuv420p
-c:a aac`) is the safe, broadly-compatible default used throughout this
cookbook — plays everywhere, uploads cleanly to Vimeo/YouTube/anywhere else.
Don't reach for a different codec combination unless the user specifically
needs one (e.g. a platform with unusual requirements).

## Quick sanity check on any output

Before handing a file to the user, confirm it's actually valid — this catches a
botched filter graph or a silently-truncated stream before it becomes an
awkward "the video doesn't play" conversation:

```bash
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,codec_type,width,height -of default=noprint_wrappers=1 output.mp4
```

Expect to see exactly one `codec_type=video` line (`h264`) and one
`codec_type=audio` line (`aac`), plus a duration that matches what was
expected from the script's total runtime.
