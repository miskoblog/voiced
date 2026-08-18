/**
 * Demo video screen-recording template — Playwright, per-segment isolated.
 *
 * COPY THIS FILE and adapt BASE_URL/GATE_PASSWORD/unlockPage and the BEATS
 * array to the actual app's shot list from SKILL.md Phase 2. This is the
 * fully verified architecture from the last build of this skill — every
 * design choice below was arrived at by fixing a real, observed defect, not
 * speculatively. Read the comments before changing the structure.
 *
 * ARCHITECTURE — EACH NARRATION SEGMENT IS RECORDED IN ITS OWN FRESH BROWSER
 * CONTEXT, not cut out of one long continuous recording, and not even one
 * context per beat. Split every beat's approved narration into clause-level
 * segments, each paired 1:1 with the specific on-screen action it describes.
 * This was a hard-learned fix: headless Chromium's screencast-based video
 * recorder is not guaranteed real-time, and under sustained DOM churn (many
 * clicks, dropdown open/close, repeated style updates) it measurably falls
 * behind wall-clock — verified by extracting exact frame numbers and
 * comparing against Date.now()-logged timestamps; the drift compounded to
 * 1-2+ seconds by the middle of a 9-segment beat. A single continuous
 * recording cut by timestamp cannot be trusted to stay in sync with its
 * voiceover. Recording each segment as its own short, fresh context
 * sidesteps the problem entirely (frame 0 = context creation, negligible lag
 * over just a few seconds) at the cost of more browser churn — worth it.
 *
 * Because each segment starts from a fresh page load, any segment whose
 * action leaves persistent state on screen (a checked box, a filled field, a
 * generated output) declares a `replay` function — a fast, unanimated
 * re-application of that same state, run silently at the start of every
 * later segment in the same beat so accumulated progress is still visible,
 * before that segment's own animated action begins.
 *
 * CONTINUITY BETWEEN SEGMENTS — every segment's fresh page resets scroll
 * position and cursor position by default, which (if left alone) reads as a
 * jarring jump-cut every time segments are concatenated: the page snapping
 * to a different scroll spot, the cursor popping back to its start position.
 * The runner below carries `lastScrollY`/`lastCursorPos` forward and
 * silently restores them (instant, no animation) right after setup/replay,
 * before the segment's own visible action starts.
 *
 * INVISIBLE-BUT-ACTUALLY-VISIBLE PREFIX — recordVideo captures from context
 * creation onward, so setup + replay steps are NOT actually invisible,
 * they're just fast; with several chained replay steps (each carrying
 * Playwright's own actionability waits) that "fast" can still be a real
 * 1-3s of visible navigation/clicking on camera before the segment's own
 * action even starts. The runner marks `visibleStart` (elapsed time at the
 * point the segment's own action begins) and writes it to that segment's
 * clicks.json; assembly MUST trim everything before that timestamp out of
 * the segment's video (see the skill's ffmpeg cookbook / assemble script) or
 * every segment will have a dead, replayed prefix baked into the final cut.
 *
 * CURSOR — plain arrow, 40x46px box (NOT 40x54 — that height stretches the
 * arrow's proportions into an "outstretched" look; 46 is the tallest that
 * still reads as a normal OS cursor), anchored at the tip like a native
 * pointer. `preserveAspectRatio="none"` on the SVG is REQUIRED — without it
 * the browser letterboxes the square 24x24 viewBox inside this non-square
 * box instead of stretching it, silently adding unaccounted offset. The
 * CURSOR_TIP_OFFSET_X/Y constants below (2, 0) were measured empirically —
 * render the cursor alone to a screenshot, scan pixel-by-pixel for the first
 * non-background pixel from the anchor point — NOT derived from viewBox
 * math, which proved unreliable both times this was tried. If you change the
 * SVG's viewBox/path or the box's width/height, re-measure these two
 * constants the same way (see "Re-measuring cursor tip offset" below) rather
 * than guessing new values.
 *
 * CLICK RING — an expanding colored ring fires on every real mousedown,
 * fired at (clickX + CURSOR_TIP_OFFSET_X, clickY + CURSOR_TIP_OFFSET_Y) so
 * it's centered exactly on the cursor's visual tip, not the div's anchor
 * corner. It's appended to the DOM BEFORE the cursor div, in addition to a
 * lower z-index — two independent guarantees the cursor paints in front of
 * the ring, not behind it (a real defect that shipped once: the ring was
 * technically correctly positioned but rendered on top, hiding the cursor
 * tip inside it). Pair this with a short synthesized click sound mixed in at
 * the same timestamp during assembly (see ffmpeg-cookbook.md) — it's the
 * click sound + ring + cursor-scale-down-on-press together that reads as a
 * real, deliberate click instead of the cursor just silently teleporting.
 *
 * initCursor() MUST BE THE LAST CALL IN setup() — this is an ordering
 * requirement, not a style preference, and it is a whole bug class rather than
 * a one-off. initCursor attaches the mousedown listener that fires the
 * click-ring animation. Any state-priming you do AFTER it (primeBrief,
 * primeShip, real page.click/fill/check calls) therefore fires a full visible
 * ring-pop per call, even though those clicks are supposed to be invisible.
 * Because priming runs immediately before `visibleStart` is marked, a
 * still-fading ring bleeds into the first frames of the trimmed on-camera
 * footage — which a client reported as the ring "blinking constantly," and it
 * took a real debugging round to trace back here. So: prime all state first,
 * inject the cursor last, and resist the urge to move initCursor() up to the
 * top of a new beat's setup() because it reads more naturally there.
 *
 * setup() MUST NOT SWITCH THE APP'S TABS — priming is only for restoring state
 * a real user would already have at that point (filled fields, checked boxes,
 * a generated result). Moving between the app's own top-level views is
 * narrative: it belongs to the beat's FIRST segment as a normal animated
 * clickAnimated on the nav button, with a matching `replay` so later segments
 * in the same beat still land on the right tab. Priming the tab switch in
 * setup() instead makes the beat open already on the new tab and the viewer
 * never sees the cursor go there — the single most-reported defect on the last
 * real build.
 *
 * EVERY VISIBLE CLICK IS AN ANIMATED CLICK — inside a segment's `action`, use
 * clickAnimated/typeAnimated/selectAnimated only; never a bare page.click(),
 * page.check() or page.fill(). A state change with no cursor on it reads as an
 * edit rather than a demo. `setup` and `replay` are the exceptions and the
 * exceptions are structural, not stylistic: both run before the segment's
 * `visibleStart`, which assembly trims out of the cut, so plain instant
 * Playwright calls are correct there (and __suppressEffects stops the ring
 * from firing while replays run). Tab/top-menu switches in particular must be
 * their own animated segment — that click is how the video signals it's moving
 * from one feature to the next.
 *
 * CENTER-START CURSOR — every beat with a cursor silently jumps it to
 * screen-center right after injecting it (before the first real glide, for
 * the beat's first segment only), so it never visibly travels in from
 * Playwright's default top-left corner. Starting from a screen corner reads
 * as an obvious recording artifact; starting from center reads as "the
 * cursor was already there."
 *
 * DROPDOWNS — native <select> popups aren't reliably captured by Chromium's
 * headless recordVideo. A styled overlay list (white rows, selected item
 * highlighted solid) is rendered and held on screen for ~550ms BEFORE the
 * cursor glides down and "clicks" the target option — showing the available
 * choices, not just snapping straight to the answer, matters for a demo
 * video (a viewer should see there were other options to pick from).
 *
 * SMOOTH SCROLLING — every scroll uses `element.scrollIntoView({behavior:
 * "smooth"})` / `window.scrollTo({..., behavior: "smooth"})`, never an
 * instant snap. Instant scrolling was the single biggest thing that made an
 * earlier cut of this kind of video read as a series of jump-cuts instead of
 * a real screen recording — smooth scrolling is not optional polish here,
 * it's required for the footage to look like genuine screen capture.
 *
 * SETUP: uses the Playwright already installed for this environment — do NOT
 * run `npm install playwright` or `playwright install`, both are unnecessary
 * and can conflict with the pinned browser build (require it from
 * `/opt/node22/lib/node_modules/playwright` as below, or set
 * `NODE_PATH=/opt/node22/lib/node_modules` and a bare `require("playwright")`
 * if running a standalone script outside this file, e.g. for tip-offset
 * measurement). Requires the app to be reachable — see SKILL.md Phase 0 on
 * why this should be a locally-served copy, not the live URL, even once the
 * live domain is allowlisted.
 *
 * RUN: node record_demo.js [ONLY_BEATS=01-x,02-y env var to filter, for
 *      re-recording a single beat during iteration without redoing everything]
 * OUTPUT: recordings/<beat-name>/manifest.json (segment texts, in order)
 *         recordings/<beat-name>/segNN/*.webm + clicks.json
 *           ({visibleStart, clicks: [seconds from segment start, ...]})
 */

const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:8420/"; // REPLACE — the app's local-mirror URL, see Phase 0
const GATE_PASSWORD = "REPLACE — the app's actual gate password, if gated";
const OUTPUT_DIR = path.join(__dirname, "..", "recordings");
const VIEWPORT = { width: 1920, height: 1080 };
const TYPE_DELAY = 55; // ms between keystrokes, so typing is visible on screen

// Tip vertex placed at (1,1) — right in the viewBox's corner (1 unit of
// margin, just enough for the stroke to render without clipping) — so the
// div's anchor point (= the real click coordinate) sits almost exactly where
// the arrow visually points, matching a real OS cursor's hotspot.
const CURSOR_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" preserveAspectRatio="none">' +
      '<path d="M1 1 L1 19 L6 14.2 L9.4 20.6 L12.1 19.2 L8.6 13 L15 13 Z" fill="#000" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>' +
      "</svg>"
  );

const PAGE_INIT = `
(() => {
  if (window.__cursorInit) return;
  window.__cursorInit = true;
  const style = document.createElement('style');
  style.textContent = \`
    #__fake-cursor {
      position: fixed; top: -100px; left: -100px; width: 40px; height: 46px;
      background: url('${CURSOR_SVG}') no-repeat center / 100% 100%;
      pointer-events: none; z-index: 2147483647;
      transition: transform 110ms ease-out;
    }
    #__fake-cursor.__pressed { transform: scale(0.5); }
    #__click-ring {
      position: fixed; width: 16px; height: 16px; margin-left: -8px; margin-top: -8px;
      border-radius: 50%; border: 3px solid #4636E3;
      background: rgba(70, 54, 227, 0.16);
      pointer-events: none; z-index: 2147483646;
      opacity: 0; transform: scale(0.4);
    }
    #__click-ring.__firing {
      animation: __ring-pop 420ms cubic-bezier(.2,.8,.2,1) forwards;
    }
    @keyframes __ring-pop {
      0%   { opacity: 0.9; transform: scale(0.4); }
      60%  { opacity: 0.7; }
      100% { opacity: 0; transform: scale(2.6); }
    }
    #__fake-dropdown {
      position: fixed; background: #fff; border: 1px solid #d9d9e3;
      border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.18);
      z-index: 2147483646; overflow: hidden;
    }
    #__fake-dropdown .__opt { padding: 9px 12px; }
  \`;
  document.head.appendChild(style);
  // Ring appended BEFORE the cursor, in addition to its lower z-index — two
  // independent guarantees the cursor paints on top, not one relying on
  // z-index alone (see file header — this was a real shipped defect once).
  const ring = document.createElement('div');
  ring.id = '__click-ring';
  document.body.appendChild(ring);
  const cur = document.createElement('div');
  cur.id = '__fake-cursor';
  document.body.appendChild(cur);
  document.addEventListener('mousemove', (e) => {
    cur.style.left = e.clientX + 'px';
    cur.style.top = e.clientY + 'px';
  }, true);
  // Empirically measured (see file header + "Re-measuring cursor tip offset"
  // below) — do not replace with viewBox-derived math, it doesn't hold up.
  const CURSOR_TIP_OFFSET_X = 2;
  const CURSOR_TIP_OFFSET_Y = 0;
  window.__fireRing = (x, y) => {
    ring.style.left = x + CURSOR_TIP_OFFSET_X + 'px';
    ring.style.top = y + CURSOR_TIP_OFFSET_Y + 'px';
    ring.classList.remove('__firing');
    void ring.offsetWidth; // restart the CSS animation
    ring.classList.add('__firing');
  };
  window.__suppressEffects = false; // set true while silently replaying prior segments' state
  document.addEventListener('mousedown', (e) => {
    cur.classList.add('__pressed');
    if (!window.__suppressEffects) window.__fireRing(e.clientX, e.clientY);
  }, true);
  document.addEventListener('mouseup', () => cur.classList.remove('__pressed'), true);

  window.__openDropdown = (selector) => {
    const select = document.querySelector(selector);
    const rect = select.getBoundingClientRect();
    const cs = getComputedStyle(select);
    const list = document.createElement('div');
    list.id = '__fake-dropdown';
    list.style.left = rect.left + 'px';
    list.style.top = (rect.bottom + 3) + 'px';
    list.style.width = rect.width + 'px';
    list.style.font = cs.font;
    Array.from(select.options).forEach((opt) => {
      const row = document.createElement('div');
      row.className = '__opt';
      row.textContent = opt.textContent;
      row.dataset.value = opt.value;
      const selected = opt.value === select.value;
      row.style.background = selected ? '#4636E3' : '#fff';
      row.style.color = selected ? '#fff' : '#16161d';
      list.appendChild(row);
    });
    document.body.appendChild(list);
  };
  window.__highlightDropdownOption = (value) => {
    const list = document.getElementById('__fake-dropdown');
    if (!list) return null;
    let targetRect = null;
    Array.from(list.children).forEach((row) => {
      const match = row.dataset.value === value;
      row.style.background = match ? '#4636E3' : '#fff';
      row.style.color = match ? '#fff' : '#16161d';
      if (match) targetRect = row.getBoundingClientRect();
    });
    if (!targetRect) return null;
    return { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
  };
  window.__closeDropdown = () => {
    const list = document.getElementById('__fake-dropdown');
    if (list) list.remove();
  };
})();
`;

async function initCursor(page) {
  await page.evaluate(PAGE_INIT);
}

// Jump the (invisible-until-first-event) cursor to screen center in one
// instant, unanimated move — so the first *visible* glide starts from the
// middle of the screen, never from the top-left corner where Playwright's
// virtual mouse begins by default. Call only for a beat's first segment.
async function centerCursor(page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
}

// Smoothly pans to an element only if it's actually out of view (a no-op
// otherwise) — see file header on why this must never be an instant snap.
async function smoothScrollIntoView(page, selector, index) {
  const scrolled = await page.evaluate(
    ([sel, idx]) => {
      const el = idx == null ? document.querySelector(sel) : document.querySelectorAll(sel)[idx];
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const inView = r.top >= 0 && r.bottom <= window.innerHeight;
      if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return !inView;
    },
    [selector, index === undefined ? null : index]
  );
  if (scrolled) await page.waitForTimeout(650); // let the smooth scroll finish before acting
}

async function smoothScrollToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(650);
}

async function moveTo(page, selector) {
  const loc = page.locator(selector);
  await smoothScrollIntoView(page, selector);
  const box = await loc.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 25 }); // steps = the visible glide, not a teleport
  await page.waitForTimeout(150);
  return { x, y };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function logClick(ctx) {
  ctx.clicks.push(round((Date.now() - ctx.beatStart) / 1000));
}

// Post-click settle time is deliberately generous — the app's own CSS
// transitions (checkbox fill, tab pill color, etc) need to fully finish and
// be captured on screen before this segment's context closes.
const CLICK_SETTLE_MS = 350;

async function clickAnimated(page, selector, ctx) {
  await moveTo(page, selector);
  await page.mouse.down();
  await page.waitForTimeout(110);
  await page.mouse.up();
  logClick(ctx);
  await page.waitForTimeout(CLICK_SETTLE_MS);
}

async function typeAnimated(page, selector, text, ctx) {
  await moveTo(page, selector);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.up();
  logClick(ctx); // the focus click also gets a tick sound
  await page.waitForTimeout(250);
  await page.type(selector, text, { delay: TYPE_DELAY });
}

// Shows the rendered dropdown list, holds it open (~550ms) so the available
// options are actually visible on screen, THEN glides the cursor down onto
// the target option and clicks it, then applies the real value and closes
// the overlay. Do not skip the hold — clicking straight through defeats the
// point of rendering the dropdown at all.
async function selectAnimated(page, selector, value, ctx) {
  await moveTo(page, selector);
  await page.mouse.down();
  await page.waitForTimeout(110);
  await page.mouse.up();
  logClick(ctx);
  await page.evaluate((sel) => window.__openDropdown(sel), selector);
  await page.waitForTimeout(550); // dropdown visibly open before anything is picked
  const optPos = await page.evaluate((val) => window.__highlightDropdownOption(val), value);
  if (optPos) {
    await page.mouse.move(optPos.x, optPos.y, { steps: 12 });
    await page.waitForTimeout(250);
  }
  await page.mouse.down();
  await page.waitForTimeout(110);
  await page.mouse.up();
  logClick(ctx);
  await page.evaluate(() => window.__closeDropdown());
  await page.selectOption(selector, value);
  await page.waitForTimeout(CLICK_SETTLE_MS);
}

async function scrollToAnimated(page, selector, ms) {
  await smoothScrollIntoView(page, selector);
  await page.waitForTimeout(ms || 300);
}

async function hold(page, ms) {
  await page.waitForTimeout(ms);
}

// REPLACE with the real app's unlock flow (adapt selector/localStorage key),
// or delete if the app isn't gated.
async function unlockPage(page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.setItem("app_access", "granted"));
  await page.reload();
  await page.waitForSelector("#gate.is-unlocked", { state: "attached" });
}

// Each beat: `setup` runs at the start of EVERY segment's fresh page (not
// once) — navigation/unlock/cursor-init. `segments` run one per fresh
// context; each one's `text` is exactly a clause of the approved script, its
// `action` the on-screen step that clause describes. `replay` (when present)
// is a fast, unanimated re-application of the state that action leaves
// behind, run silently at the top of every later segment in the same beat.
//
// REPLACE this whole array with the real app's shot list from SKILL.md
// Phase 2 — this is a worked example, not filler.
//
// BEAT NUMBERING: video Beat 1 (the static main-product screenshot hook) is NOT
// recorded here — it's a still image composited in Phase 6, so this array starts
// at what the viewer sees second. `01-gate-locked` + `02-gate-unlock` together
// are Phase 2's fixed "Beat 2 — unlock the app on camera": the password typed on
// screen at real speed, never skipped or pre-authenticated.
//
// The tail of this array is also fixed by Phase 2 and easy to forget, since the
// worked example below stops after the tool beats. Every video ends with:
//   <n-1>  the app's "How to Use" tab, scrolled through at readable speed
//   <n>    the login/gate page again, held static (cursor: false, no animation)
// Scaffolding for both is commented at the bottom of this array — fill them in
// rather than deleting them.
const BEATS = [
  {
    name: "01-gate-locked",
    cursor: false,
    setup: async (page) => {
      await page.goto(BASE_URL);
      await page.waitForSelector("#gatePassword");
    },
    segments: [
      {
        text: "Example: intro narration over the locked gate, no clicks this segment.",
        action: async (page) => hold(page, 400),
      },
    ],
  },
  {
    name: "02-gate-unlock",
    cursor: true,
    setup: async (page) => {
      await page.goto(BASE_URL);
      await page.waitForSelector("#gatePassword");
      await initCursor(page);
    },
    segments: [
      {
        text: "Example: typing the password.",
        action: async (page, ctx) => typeAnimated(page, "#gatePassword", GATE_PASSWORD, ctx),
        replay: async (page) => page.fill("#gatePassword", GATE_PASSWORD),
      },
      {
        text: "Example: submitting to unlock.",
        action: async (page, ctx) => {
          await clickAnimated(page, "#gateForm button[type=submit]", ctx);
          await page.waitForSelector("#gate.is-unlocked", { state: "attached" });
        },
      },
    ],
  },
  // REPLACE below with one beat per tool/tab per the shot list. Worked
  // pattern for a tab + dropdown + checkbox + generate + scroll-to-top.
  //
  // Note the setup() ordering and what it does NOT do: it silently restores
  // state from EARLIER beats (so this beat opens on a realistically used app),
  // it does NOT switch to this beat's own tab, and initCursor() is dead last so
  // none of the priming clicks fire a visible ring. Both rules are explained in
  // the file header.
  // {
  //   name: "03-tool-one",
  //   cursor: true,
  //   setup: async (page) => {
  //     await unlockPage(page);
  //     await primePriorBeats(page);   // e.g. refill the previous tool's inputs
  //     await initCursor(page);        // LAST — never before the priming above
  //   },
  //   segments: [
  //     {
  //       // The tab switch is this beat's first on-camera action, never setup's.
  //       text: "Open the tool's tab.",
  //       action: async (page, ctx) => clickAnimated(page, '.tab-btn[data-tab="tool"]', ctx),
  //       replay: async (page) => page.click('.tab-btn[data-tab="tool"]'),
  //     },
  //     {
  //       text: "Pick an option from the dropdown.",
  //       action: async (page, ctx) => selectAnimated(page, "#toolSelect", "value", ctx),
  //       replay: async (page) => page.selectOption("#toolSelect", "value"),
  //     },
  //     {
  //       text: "Check a box.",
  //       action: async (page, ctx) => clickAnimated(page, "#toolCheckbox", ctx),
  //       replay: async (page) => page.check("#toolCheckbox"),
  //     },
  //     {
  //       text: "Generate — and scroll back to the top so the whole result is visible, since checking boxes further down may have scrolled the page.",
  //       action: async (page, ctx) => {
  //         await clickAnimated(page, "#toolGenerate", ctx);
  //         await page.waitForSelector("#toolOutput .result");
  //         await smoothScrollToTop(page);
  //         await hold(page, 600);
  //       },
  //       replay: async (page) => {
  //         await page.click("#toolGenerate");
  //         await page.waitForSelector("#toolOutput .result");
  //         await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); // replay is off-camera — instant here is correct
  //       },
  //     },
  //   ],
  // },
  //
  // ---- FIXED CLOSING BEATS (Phase 2) — fill these in, don't drop them ----
  //
  // Second-to-last: the app's own "How to Use" tab, scrolled at readable speed.
  // {
  //   name: "98-how-to-use",
  //   cursor: true,
  //   setup: async (page) => { await unlockPage(page); await initCursor(page); }, // initCursor last
  //   segments: [
  //     {
  //       // Again: the tab switch is a visible click, not a setup() jump.
  //       text: "Open the How to Use tab.",
  //       action: async (page, ctx) => clickAnimated(page, '.tab-btn[data-tab="guide"]', ctx),
  //       replay: async (page) => page.click('.tab-btn[data-tab="guide"]'),
  //     },
  //     {
  //       text: "Narration over the guide while it scrolls — one segment per screenful so the pacing matches the voiceover.",
  //       action: async (page) => scrollToAnimated(page, ".guide-section:nth-of-type(3)", 700),
  //     },
  //   ],
  // },
  //
  // Last: back to the gate, held static. No cursor, no scroll, no animation —
  // this is the final image the viewer holds, and motion here reads as filler
  // for the same reason it does on the Beat 1 hook.
  // {
  //   name: "99-login-static",
  //   cursor: false,
  //   setup: async (page) => {
  //     await page.goto(BASE_URL);           // fresh load = gate locked again
  //     await page.waitForSelector("#gatePassword");
  //   },
  //   segments: [
  //     {
  //       text: "Closing narration — where to get it and what to do next.",
  //       action: async (page) => hold(page, 400),
  //     },
  //   ],
  // },
];

(async () => {
  const only = (process.env.ONLY_BEATS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const beatsToRun = only.length ? BEATS.filter((b) => only.includes(b.name)) : BEATS;

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

  for (const beat of beatsToRun) {
    const beatDir = path.join(OUTPUT_DIR, beat.name);
    fs.mkdirSync(beatDir, { recursive: true });
    const manifest = [];
    const replaysSoFar = [];
    let lastScrollY = null;
    let lastCursorPos = null;

    for (let i = 0; i < beat.segments.length; i++) {
      const seg = beat.segments[i];
      const segDir = path.join(beatDir, `seg${String(i + 1).padStart(2, "0")}`);

      // Capture beatStart BEFORE newContext(), not after — timestamping
      // after context creation caused systematic drift between the logged
      // click time and the actual click frame in testing.
      const beatStart = Date.now();
      const context = await browser.newContext({
        viewport: VIEWPORT,
        recordVideo: { dir: segDir, size: VIEWPORT },
      });
      const page = await context.newPage();
      const ctx = { beatStart, clicks: [] };

      await beat.setup(page, ctx);
      if (beat.cursor && replaysSoFar.length) {
        await page.evaluate(() => { window.__suppressEffects = true; });
      }
      for (const replay of replaysSoFar) {
        await replay(page);
      }
      if (beat.cursor && replaysSoFar.length) {
        await page.evaluate(() => { window.__suppressEffects = false; });
      }

      if (i === 0) {
        if (beat.cursor) await centerCursor(page);
      } else {
        if (lastScrollY !== null) {
          await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), lastScrollY);
        }
        if (beat.cursor && lastCursorPos) {
          await page.mouse.move(lastCursorPos.x, lastCursorPos.y);
        }
        await page.waitForTimeout(150);
      }

      // See file header ("INVISIBLE-BUT-ACTUALLY-VISIBLE PREFIX") — mark the
      // boundary and trim everything before it out in assembly.
      const visibleStart = round((Date.now() - beatStart) / 1000);

      await seg.action(page, ctx);
      await page.waitForTimeout(300);

      lastScrollY = await page.evaluate(() => window.scrollY);
      if (beat.cursor) {
        lastCursorPos = await page.evaluate(() => {
          const c = document.getElementById("__fake-cursor");
          if (!c) return null;
          return { x: parseFloat(c.style.left) || 0, y: parseFloat(c.style.top) || 0 };
        });
      }

      await context.close(); // video only finalizes to disk on context close

      fs.writeFileSync(
        path.join(segDir, "clicks.json"),
        JSON.stringify({ visibleStart, clicks: ctx.clicks })
      );
      manifest.push({ index: i + 1, text: seg.text, dir: `seg${String(i + 1).padStart(2, "0")}` });
      if (seg.replay) replaysSoFar.push(seg.replay);
      console.log(`  ${beat.name} seg${String(i + 1).padStart(2, "0")}: ${ctx.clicks.length} click(s)`);
    }

    fs.writeFileSync(path.join(beatDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`Recorded beat: ${beat.name} — ${manifest.length} segments`);
  }

  await browser.close();
  console.log(`Done. Recordings in ${OUTPUT_DIR}/<beat-name>/manifest.json + segNN/*.webm + clicks.json`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Re-measuring cursor tip offset (if you change CURSOR_SVG or the box size):
 *
 * 1. Render just the cursor div (no page content) onto a solid, unambiguous
 *    background color at a known anchor position, e.g. left:150px;top:150px.
 * 2. Screenshot it, then scan pixels in raster order (y outer, x inner)
 *    starting at the anchor coordinate for the first non-background pixel —
 *    that's the tip's rendered offset from the anchor.
 * 3. Verify by rendering the click-ring at (anchor + candidate offset) next
 *    to the cursor and visually confirming the ring is centered on the tip
 *    with the cursor rendered in front — try a small grid of nearby
 *    candidate offsets (±2px) side by side and pick the best visual match,
 *    don't stop at the first pixel-scan result without a visual check.
 * 4. Never trust viewBox-ratio math for this (scaleX * tip.x, scaleY *
 *    tip.y) — it was tried twice on this project and was off both times
 *    (stroke width, anti-aliasing, and preserveAspectRatio letterboxing all
 *    threw it off in ways that were hard to predict analytically). Always
 *    measure empirically against an actual render.
 */
