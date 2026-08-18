---
name: demo-video-builder
description: Produces a narrated demo video for a bonus app built with the jv-bonus-builder skill (or any web app), explaining how to use it and how it complements the main product it's a bonus for. Covers the full pipeline — script/shot list, real screen-capture recording via Playwright, ElevenLabs voiceover, and ffmpeg assembly into a final MP4. Invoke this whenever the user asks for a demo video, walkthrough video, explainer video, or "how to use" video for an app, or says something like "let's make a video for [app]" — even without the word "skill." Meant to run in its own dedicated session, separate from the app-building session.
---

# Demo Video Builder

Produces a narrated screen-capture demo video end to end: script → real screen
recording of the actual app → AI voiceover → assembled MP4. This is a genuinely
different kind of output than the other skills in this repo (video, not code or
docs), so read this whole file before starting — the failure modes are different
too (a broken package mirror, a missing API key, an untested ffmpeg command all
fail silently-looking in ways that are easy to ship by accident).

## What this skill can and can't do — be upfront about this immediately

Tell the user this plainly at the start of the session, don't let them discover
it partway through:

- **Screen recording**: fully automated, real footage (Playwright drives an
  actual browser through the app and records real video — not a mockup, not
  slides pretending to be a demo).
- **Voiceover**: fully automated *if* the user provides an ElevenLabs API key.
  **Never accept account login/password for this or any service** — that's not
  something to ask for or use even if offered; the correct integration is a
  scoped, revocable API key (ElevenLabs: profile icon → API Keys → create one,
  ideally scoped to text-to-speech only). If offered a login/password instead of
  a key, decline it and ask for a key specifically, explaining why.
- **Assembly (mux audio+video, trim, captions, export)**: fully automated via
  `ffmpeg`, confirmed working in this environment (see "Environment setup").
- **Hosting/upload** (Vimeo, YouTube, etc.): not automated — hand the user the
  final file; they upload it themselves unless a connector for that platform is
  available (check `ListConnectors` early if relevant).

## Phase 0 — Network access (check this first, at session start)

This runs in a sandboxed environment with an egress allowlist ("Custom network
access" in the environment settings) — outbound requests to anything not on it
get a 403 policy denial. Two hosts this skill needs almost always aren't on it
yet by default:

1. **The app's live domain** (whatever's given in Phase 1's "which app").
2. **`api.elevenlabs.io`** — required for every Phase 5 voiceover call.

Tell the user up front, before going deep into intake, to add both to this
environment's Custom network access — don't wait to discover the block mid-way
through Phase 4 or Phase 5 and stall a mostly-finished session on it. If the
app's domain isn't known yet at session start, at least flag `api.elevenlabs.io`
immediately since that one's needed regardless of which app this is for.

**Important nuance discovered building this skill**: allowlisting a domain
fixes plain HTTP calls (`curl`, the ElevenLabs API, fetching the app's
HTML/CSS/JS) but does **not** reliably fix Playwright/Chromium navigating
there directly — browser-driven traffic to a remote domain got reset at the
network level even after the domain was allowlisted and reachable via `curl`
in the same session. Don't burn time debugging Chromium proxy flags when this
happens. Instead, for Phase 4 recording: if the app is a static site (no
server-side logic), mirror it locally instead of pointing Playwright at the
live URL — `curl` down the HTML/CSS/JS (check for other referenced assets:
`grep -oE '(src|href)="[^"]*"'` on the HTML, `grep -oE "url\([^)]*\)"` on the
CSS), serve it with `npx http-server -p 8420 <mirror-dir>`, and record against
`http://localhost:8420/`. This is functionally identical for a client-side app
with no backend calls, and sidesteps the sandbox limitation entirely rather
than fighting it. If the app has server-side dependencies that make a local
mirror not viable, that's a real blocker worth surfacing to the user rather
than working around.

## Phase 1 — Intake

Ask for:

1. **Which app** is this a demo for — and where it actually lives:
   - If it's on GitHub: the **owner/account** and **repo name** separately
     (e.g. "repo is called bridgekitdev, it's in my GitHub account") so it can
     be added to the session with `add_repo` and cloned — a bare repo name
     without the owner isn't enough to resolve it.
   - If it's already deployed: the live URL instead (or in addition — a live
     URL is more representative of what viewers will see, but the repo is
     still useful for context).
2. **The proposal/concept document**, if one exists — ask the user to attach
   it rather than re-describing it in chat. A single proposal doc (like the
   one `jv-bonus-builder` produces) usually covers *both* of the next two
   items at once — the gap/positioning analysis and the main-product context
   — so reading it directly saves a round trip and is more reliable than
   asking the user to summarize their own doc from memory:
   - **What's the main product this is a bonus for** — same JV doc / sales
     page inputs as `jv-bonus-builder`'s Phase 1, if not already known from
     context or pulled from the proposal doc.
   - **The approval report / concept summary**, if built with
     `jv-bonus-builder` and not included in the proposal doc above (saves
     re-deriving the gap/positioning from scratch).
3. **A screenshot of the main product being promoted** (its sales page,
   dashboard, or a key screen) — this is what the hook beat in Phase 2 opens
   on, so the video shows the actual gap in the actual product instead of
   just describing it over a text card. Ask for this explicitly, even if a
   proposal doc was already provided — the doc covers positioning, not visual
   footage.

   **Attaching the image in chat often fails, so give the GitHub route up
   front rather than after a failed attempt.** Chat image uploads have been
   rejected outright in real sessions, and the failure looks like the user's
   problem when it isn't. Committing the screenshot into the bonus app's repo
   sidesteps it completely — that repo is already being cloned into the session
   from item 1, so once the image is committed there it's just a local file this
   session can read directly. Hand the user these steps, substituting the real
   names (`<account>` = their GitHub account, `<bonus-app-repo>` = the repo from
   item 1, `<Main Product>` = the product being promoted):

   1. Go to `https://github.com/<account>/<bonus-app-repo>`
   2. Make sure you're on the branch you want to add it to — click the branch
      dropdown (top-left, probably says "main") and pick `main`. That's fine
      here: it's just an image asset, no code.
   3. Click the **"Add file"** dropdown (top-right of the file list) →
      **"Upload files."**
   4. Drag the screenshot into the upload box, or click "choose your files" and
      select it from your computer.
   5. Scroll down to the **"Commit changes"** section. Leave the commit message
      as-is or write something like "Add `<Main Product>` hero screenshot."
   6. Make sure **"Commit directly to the main branch"** is selected.
   7. Click the green **"Commit changes"** button.

   Then tell them the file will exist at
   `https://github.com/<account>/<bonus-app-repo>/blob/main/<filename>` and ask
   them to confirm once it's committed. **If the repo was already cloned earlier
   in the session, `git pull` before looking for the file** — the clone predates
   the upload and won't have it, which reads as a failed upload if you skip this.
   Screenshot filenames from a desktop are often long and space-laden (e.g.
   `Captura de pantalla 2026-08-12 164507.png`); that works fine, just quote the
   path in any shell command, or offer to rename it in-repo to something like
   `main-product-hero.png` once it's in.

   Only if the user genuinely can't produce a screenshot at all, confirm a
   text-only title card is an acceptable fallback for the hook before defaulting
   to it — don't reach for the fallback just because the first upload attempt
   failed.
4. **Target length** — don't treat this as a hard budget to squeeze the content
   into. Phase 2 allots up to 60 seconds per feature, plus the four fixed beats
   (hook, unlock, "How to Use", close), so the runtime is largely a consequence
   of how many features the app has: a three-tool app lands around 4–5 minutes,
   and that's correct rather than overlong. Ask the user for a preference, and if
   they name a length that's tighter than the feature count allows, say so
   plainly and let them choose — cut a feature beat, or accept the longer
   runtime. Don't silently compress every feature to fit; that produces the
   spec-list feel Phase 2 exists to avoid.
5. **Voice** — ask the user to pick or describe a voice from their ElevenLabs
   account (or just say "pick something clear and professional" and use a
   default ElevenLabs voice — see `references/elevenlabs.md`).

Don't block on all five up front — ask, but if the user volunteers items out
of order (e.g. drops a repo name and a proposal doc in the same message
before you've asked about voice), take them as given and only chase what's
still missing.

## Phase 2 — Script + shot list

Write these together, line by line, not as separate documents — every line of
narration needs a paired "what's on screen / what action happens" note, because
that pairing is what the recording step in Phase 4 executes against.

**Four of these beats are fixed** — first, second, second-to-last, and last are
always the same shot, in the same order, on every video this skill produces. Only
the feature beats in the middle vary in count. This fixed frame exists so every
demo in the series opens and closes the same recognizable way; don't redesign it
per launch:

1. **Beat 1 — Hook, on the main product (fixed).** Open on the gap the main
   product itself admits to (same kind of evidence-based framing used in
   `jv-bonus-builder`'s concept validation — a quoted or paraphrased line from the
   main product's own sales material about what it doesn't cover), shown over the
   main-product screenshot gathered in Phase 1. This is what makes the bonus's
   existence make sense in the first 10 seconds, not an afterthought at the end.
   **Hold that screenshot completely static — no zoom, no pan (Ken Burns), no
   animation of any kind.** Motion here was tried on an earlier cut and
   explicitly rejected by the client watching it: movement on a still image read
   as generic stock-footage filler rather than part of the actual demo, and
   undercut the hook instead of strengthening it. A single held frame for the
   length of the narration is correct; don't add motion unless a user asks.
2. **Beat 2 — Unlock the app on camera (fixed).** The first footage of the app
   being demoed is always its own login gate: the password typed into the field
   and the unlock clicked, in shot, at real typing speed. Never skip past the
   gate or start from an already-unlocked page. Two reasons this earns its
   seconds — it proves on camera that this is a real working app rather than a
   mockup, and it shows the buyer the exact access flow they'll go through
   themselves, so the password they're handed later isn't the first time they
   meet the gate. Continue straight from the unlock into **what this app is**, in
   one plain-language sentence, as the unlocked view lands.
   - **The password always renders as dots — this is settled, don't ask.** The
     gate field is `input[type="password"]`, so the characters mask themselves
     as they're typed. Keep it that way: never add an on-screen overlay, caption,
     or narration line that reveals the actual password, and don't swap the field
     type to make it legible. The video's job is to show that a gate exists and
     what getting through it looks like; the password itself reaches buyers
     through the launch's own delivery (the user hands it out separately, per
     `jv-bonus-builder`'s handoff), not by being readable in a video that will
     outlive the promotion and sit publicly on a video host.
3. **Feature beats — one per tool/tab, and sell the benefit (variable count).**
   Each shows the real UI performing a real, specific example (never empty
   fields), naming actual button/field labels the way the app's own "How to Use"
   tab does. But showing the mechanics is the floor, not the point. Every feature
   beat has to land three things, in narration, over that footage:
   - **The benefit of this specific feature** — what the buyer walks away able to
     do, not which buttons exist. "Prices a job in about a minute so you're not
     guessing on a quote" beats "enter scope and timeline, then click Generate."
   - **Why it's the perfect companion to the main product** — tie this feature to
     what the main product does, explicitly, feature by feature. Not saved for a
     single summary beat at the end; the connection is what justifies each
     feature's existence as this bonus rather than a generic tool.
   - **Which gap it fills** — name the specific unmet need from the Phase 1
     analysis (the `jv-bonus-builder` proposal doc's evidence quotes are the
     source) that this feature closes. The hook opens the gap; each feature beat
     closes a piece of it.

   **Open each feature beat by clicking into it on camera.** The transition from
   one feature to the next is the cursor gliding up to that feature's button in
   the app's top tab menu and clicking it — written into the shot list as its own
   segment with its own narration clause, not folded into the previous beat's
   tail. That click is what tells the viewer "we're moving to a different tool"
   without needing a title card, and it's what keeps the video legible as one
   continuous session inside one app instead of a pile of disconnected screen
   grabs. If the view changes, the cursor is on screen making it change.

   **Budget up to 60 seconds per feature.** A feature given 15 seconds reads like
   an item on a spec list; a feature given a full minute has room to state the
   benefit, make the companion connection, and let the footage actually
   demonstrate it end to end. Take the time — the total runtime follows from the
   feature count, not the other way around (see the length note in Phase 1).
4. **How it fits alongside the main product** — explicit, not implied: this isn't
   a competitor to the main product, it's the piece that picks up where it leaves
   off. Keep this one tight; since every feature beat already made its own
   companion connection, this is a short tie-together, not a re-litigation. If
   the draft repeats a feature beat's wording nearly verbatim, cut it down rather
   than padding it out.
5. **Second-to-last beat — the "How to Use" view (fixed).** Show the app's own
   "How to Use" tab on screen. Every `jv-bonus-builder` app ships with one as its
   default landing view, and putting it on camera does something narration can't:
   it shows a non-technical buyer that the app explains itself, so claiming the
   bonus doesn't come with a learning-curve worry attached. Scroll through it at
   readable speed rather than flashing it.
6. **Last beat — close on the static login page (fixed).** Return to the app's
   login/gate page and hold it **static, no animation**, while the closing
   narration covers where to get it and what to do next. This bookends the video
   deliberately: it opens on the main product's gap and closes on the door to the
   thing that fills it, with the gate as the last image the viewer holds.

Present the full script + shot list to the user together, beat by beat, with
every line of narration written out in full — exactly as it will be spoken,
not summarized or paraphrased — paired with its on-screen shot. Get explicit
approval before recording anything. Treat this as a real checkpoint, same
discipline as `jv-bonus-builder`'s concept and report checkpoints — a bad
line or a bad shot list wastes an entire recording and voiceover pass.

## Phase 3 — Environment setup

`ffmpeg` is not preinstalled in a fresh sandbox. Install it with:

```bash
apt-get update && apt-get install -y --no-install-recommends ffmpeg
```

**Run `apt-get update` first, every time**, even if it seems redundant — a bare
`apt-get install ffmpeg` failed once building this skill because the cached
package index pointed at .deb files that had rotated out of the mirror (404s on
otherwise-unrelated packages like GPU driver libraries pulled in as
dependencies). Refreshing the index first fixed it cleanly. `--no-install-recommends`
skips those unneeded GPU/hardware-acceleration packages, which is also part of
what makes this reliable — the full recommended set pulls in more than this
skill needs and is more likely to hit a broken mirror package. Verify with
`ffmpeg -version` before relying on it.

## Phase 4 — Screen recording

Use Playwright with a real browser context and `recordVideo` — this produces an
actual `.webm` recording of the app being used, timed against the shot list from
Phase 2. See `scripts/record_demo.js` for a working, fully verified template —
copy it and adapt `BASE_URL`/`GATE_PASSWORD`/`unlockPage` and the `BEATS` array
to the real app. **Read that file's header comment before changing its
structure** — every architectural choice in it exists because an earlier,
simpler version of this same recording produced a visible defect, and the
comments explain which defect and how it was diagnosed.

### Verified specifications — use these values, don't re-derive them

These were arrived at through multiple rounds of user-reviewed correction on a
real demo video and are the confirmed-good defaults for the next one. Treat
them as the starting point, not a suggestion to re-litigate:

- **Recording architecture: one fresh browser context PER NARRATION SEGMENT**
  (a clause-level slice of a beat's script, not one context per beat and
  definitely not one continuous take for the whole video). Headless Chromium's
  `recordVideo` is not guaranteed real-time and drifts under sustained DOM
  churn — verified by extracting exact frame numbers against logged
  timestamps, drift compounded past a full second within one 9-segment beat.
  Per-segment isolation resets that drift to ~0 every few seconds. Capture
  `beatStart = Date.now()` **before** `browser.newContext()`, not after —
  timestamping after context creation reintroduces measurable drift.
- **Cursor**: 40×46px box (not 40×54 — that stretched the arrow vertically
  and looked "outstretched"; 46 is the tallest that still reads as a normal
  pointer), plain black-fill/white-stroke arrow SVG, `viewBox="0 0 24 24"`,
  tip vertex at path coordinate `(1,1)`, **`preserveAspectRatio="none"`
  required** on the SVG (its absence silently letterboxes the square viewBox
  inside the non-square box instead of stretching it — a real bug that shipped
  once). Tip offset for the click ring: `CURSOR_TIP_OFFSET_X = 2`,
  `CURSOR_TIP_OFFSET_Y = 0`, measured empirically against this exact box size
  and SVG — re-measure (procedure at the bottom of `record_demo.js`) if either
  changes, never recompute from viewBox math (tried twice, wrong both times).
- **Click ring**: 16px base diameter, expands to `scale(2.6)` fading out over
  420ms (`cubic-bezier(.2,.8,.2,1)`), fired at `(clickX + tipOffsetX, clickY +
  tipOffsetY)` so it's centered on the cursor's visual tip. Appended to the DOM
  **before** the cursor div, plus a lower z-index than the cursor — both,
  redundantly, so the cursor always paints in front of the ring.
- **Click sound**: synced to the same click event as the ring (see Phase 6 for
  the actual audio mix).
- **No click ever happens without the cursor visibly doing it.** Every state
  change the viewer sees — top-menu/tab switches above all, but also buttons,
  checkboxes, dropdown options — goes through `clickAnimated` (glide → cursor
  scale-down → ring → logged click for the sound mix), never a bare
  `page.click()` / `page.check()` / `page.fill()` inside a visible `action`. A
  view that changes with no cursor on it reads as a video edit rather than a
  demo, and it costs the credibility of the whole beat, not just that second.
  The **only** exception is `setup` and `replay` code: those run before the
  segment's `visibleStart` and assembly trims them out of the cut entirely, so
  plain Playwright calls belong there (and `__suppressEffects` keeps the ring
  from firing while they run). If a step is hard to animate, animate it anyway
  or restructure the segment — don't quietly fall back to an instant call.
- **`setup()` must never switch the app's tabs.** Silent priming in `setup()` is
  only for restoring state a real user would already have at that point (filled
  fields, checked boxes, a previous tool's result). Navigation between the app's
  own top-level views is narrative, so it belongs to the beat's **first
  segment** as an ordinary `clickAnimated` on the nav button, with a matching
  `replay` so later segments in the same beat still land on the right tab. Prime
  the tab switch in `setup()` instead and the beat opens already on the new tab
  with the cursor never going there — this was the most-reported defect on the
  last real build, across several beats at once.
- **`initCursor()` is always the last call in `setup()`.** It attaches the
  mousedown listener that fires the click ring, so anything you prime *after* it
  — every `page.click`/`page.fill`/`page.check` meant to be invisible — fires a
  real visible ring-pop. Priming runs immediately before `visibleStart`, so a
  still-fading ring bleeds into the first frames of the trimmed footage; a client
  reported this as the ring "blinking constantly" and it took a debugging round
  to trace. Prime everything first, inject the cursor last. This is a bug class
  rather than a one-off — it gets reintroduced by innocently moving
  `initCursor()` to the top of a new beat's `setup()` because it reads better
  there.
- **Cursor starts at screen center**, not the corner — jump it there in one
  instant unanimated move right after injection, only for a beat's first
  segment, before the first real glide. Starting visibly from a screen corner
  reads as an obvious recording artifact.
- **Dropdowns**: render a styled overlay list and hold it open ~550ms before
  the cursor glides to and clicks the target option — a viewer needs to see
  the available choices, not just the final answer appearing.
- **Scrolling**: always `behavior: "smooth"`, never an instant snap — this is
  the single biggest lever on whether footage reads as a real screen recording
  vs. a series of jump-cuts. Only scroll when the target is actually out of
  view (check first, no-op otherwise).
- **After an action that may have scrolled the page somewhere unexpected**
  (e.g. checking several boxes scrolled down, then a "Generate" button's
  result panel needs to be visible from the top) — explicitly scroll back to
  a sensible position (e.g. `smoothScrollToTop`) as part of that action, don't
  leave the camera wherever the last click happened to land.
- **Continuity between segments**: carry `lastScrollY` and `lastCursorPos`
  forward across segment boundaries and silently restore them (instant, no
  animation) right after a new segment's setup/replay, before its own visible
  action starts. Skipping this makes concatenated segments visibly jump
  scroll position and snap the cursor back to center on every cut.
- **Sync (video ↔ voiceover)**: split narration at the clause level, one
  segment = one TTS clip = one on-screen action, not one clip per whole beat.
  This is what makes frame-accurate sync possible — a single beat-length
  voiceover clip has nowhere to pause/breathe mid-beat if the on-screen action
  needs more or less time than the narration for that specific step. See
  Phase 5/6 for the generation and assembly side of this.

Other setup notes:
- Point Playwright at a locally-served copy of the app (`npx http-server -p
  8420 <dir>`) rather than the live deployed URL — see Phase 0: browser-driven
  traffic to a remote domain can get blocked at the network level in this
  sandbox even when the domain is allowlisted for plain HTTP calls. For a
  static site, mirror the live URL's HTML/CSS/JS locally first if there's no
  local dev copy already.
- All `jv-bonus-builder` apps are password-gated, and the unlock is **always
  recorded in-shot as Beat 2** (see Phase 2) — type the password into the field
  and click through at real speed. Don't offer skipping the gate or
  pre-authenticating the context to get "cleaner" footage; the gate is part of
  the story the video tells. `record_demo.js`'s `unlockPage` handles the replay
  side for later segments, but Beat 2 itself must show the typing happen.
- Any segment whose action leaves persistent on-screen state (a checked box, a
  filled field, a generated result) needs a `replay` function — a fast,
  unanimated re-application of that same state — so later segments in the same
  beat still show accumulated progress despite starting from a fresh page.
  Run all prior segments' replays silently (suppress cursor/ring effects
  during them) at the start of every segment after the first.
- Support an `ONLY_BEATS=name1,name2` env-var filter (see the template) so a
  single beat can be re-recorded during review/iteration without re-running
  the whole video — this made the iterative fix cycle with the user far
  cheaper each round.

## Phase 5 — Voiceover (ElevenLabs)

Read `references/elevenlabs.md` for the exact API call. Needs the user's API key
(see the security note in "What this skill can and can't do" above — key only,
never a login). **Generate one audio clip per narration SEGMENT** (the
clause-level split from Phase 4, matching `record_demo.js`'s manifest.json 1:1
via each segment's own `text`) — not one clip per whole beat and not one giant
block. `scripts/generate_segment_voiceover.js` is a working template: it reads
each beat's `recordings/<beat>/manifest.json` (written by Phase 4) and
generates `audio/segments/<beat>/seg-NN.mp3` for every segment, plus the hook
beat's clip from a hardcoded text constant. Segment-level granularity is what
makes frame-accurate video/voiceover sync possible in Phase 6 — a beat-length
clip has no way to pause or breathe mid-beat if one specific on-screen step
needs more or less time than its narration.

**Request 192kbps audio explicitly** — `?output_format=mp3_44100_192` on the TTS
URL, plus `stability: 0.6`. The API's own default is 128kbps, which compresses
sibilants ("s", "sh") harshly enough that it shipped as a client-flagged defect
on a real delivery; the narration sounded hissy on exactly the consonants ears
are most sensitive to. Both values are already set in
`scripts/generate_segment_voiceover.js` — don't drop the bitrate back to save
space, and don't go re-tuning the other voice settings, since these two were the
entire fix.

## Phase 6 — Assembly

Read `references/ffmpeg-cookbook.md` for the specific commands (click-sound
mixing, trimming to match voiceover length, beat-to-beat colour dips, burning in captions,
concatenating into the final cut). All commands there were run and verified
while building this skill, not copied from documentation unverified.
`scripts/assemble_segments.py` is a working, scripted version of the full
pipeline below — copy and adapt its paths/beat list rather than re-deriving it.

**Every beat boundary gets a fade — all of them, no exceptions**, including into
Beat 1's static hook and out of the closing static login beat. Don't skip a
boundary because both sides are static stills; a hard cut between two held
frames is the most conspicuous cut in the video, not the least.

**The transition is a dip through a colour, not a crossfade.** Fade the outgoing
clip's picture out to the colour and its audio out to silence, fade the incoming
clip in from both, then hard-concat — sequential, never overlapped. `xfade` /
`acrossfade` are specifically ruled out here: chains of them silently rendered
every join after the first as a hard cut, a dissolve is invisible when adjacent
frames are near-identical (which this architecture makes common on purpose), and
overlapping two narration clips audibly dips the voice. Section 4b of
`references/ffmpeg-cookbook.md` has the full reasoning and the exact commands;
`dip_transition_concat()` in `assemble_segments.py` implements it — use that
rather than hand-rolling filter graphs.

**Ask the user what colour to dip through.** Default to the app's own CSS
background token (`--bg`) so the transition reads as the app's own ground rather
than a generic cut to black — plain black was tried on a real delivery and came
back as too harsh. It lives in one constant (`FADE_COLOR`); set it once.

**Probe video-stream durations, never container durations,** whenever a number
will be used to time a fade, trim, or pad. A muxed beat's container reports
~0.1s longer than its video stream, which is enough to push a fade past the last
real frame and silently kill it. `assemble_segments.py` splits this into
`vdur()` / `adur()` for timing and `container_dur()` for logging only.

Order of operations, per segment:
1. **Trim the invisible-but-actually-visible setup/replay prefix** off the raw
   webm using that segment's logged `visibleStart` (see Phase 4's spec list
   and the ffmpeg cookbook's "Segment-level recording & assembly" section) —
   do this before anything else, and rebase that segment's click timestamps by
   the same amount.
2. **Mix the click sound** into the segment's voiceover clip at the (now
   rebased) logged click timestamps — ffmpeg cookbook step 0.
3. **Pad whichever of video/audio is shorter** so the two match exactly:
   freeze the video's last frame (`tpad=stop_mode=clone`) if the voiceover
   runs longer (the usual case — people talk slower than a UI responds); pad
   the audio with silence (`apad`) if the on-screen action runs longer. Never
   speed up/slow down the voiceover and never trim the video mid-action.
4. **Mux** that segment's now-matched video+audio into its own final clip.

Then, per beat:
5. **Concatenate all of a beat's segment clips with a hard cut** (ffmpeg
   cookbook step 4) — same continuous screen throughout a beat, no transition
   needed within one.

Then, for the whole video:
6. **Dip every beat into the next through the fade colour** (ffmpeg cookbook
   step 4b: sequential `fade`/`afade` out then in, 0.4s per side, then a hard
   concat — never `xfade`/`acrossfade`) — including into the hook and out of the
   closing beat. Hard cuts between beats read as choppy; this is what makes the
   final export read as a produced video.
7. Add captions if requested (burned-in via `drawtext`/subtitle filter, or a
   sidecar `.srt` — ask which the user wants), export as MP4 (H.264 + AAC —
   broadly compatible, confirmed working here).

**Verify before handoff, don't just trust the pipeline ran without errors**:
`ffprobe` for correct codecs/resolution/duration, and `ffmpeg -af volumedetect
-f null -` for audio levels (watch for clipping — `max_volume` near 0dB — or a
too-quiet mix). Pull a few frames at logged click timestamps with `ffmpeg -i
clip.mp4 -vf "select='between(t,X,Y)'" -vsync 0 out_%03d.png` and actually look
at them if cursor/click-effect alignment matters for this video — spot-checking
one beat's frames caught real defects (ring behind the cursor, tip
misaligned) that ffprobe/volumedetect couldn't have caught.

## Phase 7 — Handoff

Send the final MP4 to the user directly. Don't attempt to upload anywhere
without checking first whether a relevant connector is available — assume it
isn't and hand off the file unless proven otherwise.

## Files in this skill

- `references/elevenlabs.md` — the TTS API call, key handling, voice selection.
- `references/ffmpeg-cookbook.md` — verified ffmpeg commands for every assembly
  step (click-sound mix, trim/pad, hard-cut concat within a beat, the
  fade-through-colour dip between beats, mux, caption burn-in, export), plus
  the video-stream-vs-container duration gotcha.
- `scripts/record_demo.js` — working Playwright recording template: per-segment
  isolated recording architecture, cursor + click ring + dropdown overlay with
  the verified sizing/offset specs, smooth-scroll continuity, replay-based
  state restoration across segments. Read its file header before adapting it.
- `scripts/generate_segment_voiceover.js` — working ElevenLabs TTS template,
  one clip per narration segment, reading `record_demo.js`'s manifest.json.
- `scripts/assemble_segments.py` — working end-to-end assembly script: trims
  the invisible recording prefix, mixes click sounds, pads video/audio to
  match, concatenates segments within a beat, and dips through the fade colour
  between beats via `dip_transition_concat()`.
