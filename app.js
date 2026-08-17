// ============================================================================
// Voiced — Channel Brain Brief Builder
// Static, client-side only. No API calls, no accounts, no backend.
// Everything saved lives in this browser's localStorage under the "voiced_" prefix.
// ============================================================================

const GATE_HASH = "dfb6548b2de68cdf5556ffa61190a24bc3f3a15758799a5e72348dba63abd536";

// ---------------------------------------------------------------------------
// Reference data — themes, tones, host types. Shared by the Persona Builder,
// the Differentiation Score, and the Voice & Motif Bank.
// ---------------------------------------------------------------------------

const THEMES = {
  pov: {
    label: "POV Simulation",
    catchphrases: [
      "You are here. You don't get to leave.",
      "This is what it actually felt like.",
      "Survive the next 60 seconds.",
      "One choice. No do-overs.",
    ],
    archetypes: [
      "The Unseen Guide — narrates as a second-person “you,” never named, never seen",
      "The Survivor — a named character who lived through it, narrating in first person past tense",
      "The Instructor — clinical, procedural voice, like a field manual reading itself aloud",
      "The Companion — a co-experiencer reacting alongside the viewer in real time",
    ],
    motifs: [
      "Every video opens mid-scene, no setup — the viewer is dropped straight into the moment",
      "A recurring countdown or ticking-clock overlay tied to the narration",
      "Ends on an unresolved choice, framed as a question to the viewer",
      "A signature sound cue (a specific breath, heartbeat, or radio-static sting) at moments of tension",
    ],
  },
  trivia: {
    label: "Trivia / Brainteasers",
    catchphrases: [
      "Most people get this wrong. Will you?",
      "Ninety seconds. One answer.",
      "This one breaks brains.",
      "Before I tell you — guess.",
    ],
    archetypes: [
      "The Challenger — needles the viewer, mildly competitive tone",
      "The Deadpan Host — delivers absurd facts completely flat, letting the fact do the work",
      "The Excited Nerd — genuinely delighted by the trivia, high-energy",
      "The Skeptic — frames each fact as “sounds fake, but—”",
    ],
    motifs: [
      "A consistent visual “reveal” beat (a specific transition or sound) right before the answer",
      "A running scorecard or streak counter referenced across videos in a series",
      "A recurring “one more thing” bonus fact tacked onto the end",
      "The same opening question format every video (“Quick — before you scroll—”)",
    ],
  },
  history: {
    label: "History Recreation",
    catchphrases: [
      "Here's what they didn't teach you.",
      "This actually happened. Watch it unfold.",
      "The version they didn't want written down.",
    ],
    archetypes: [
      "The Eyewitness — narrates in first person as if present at the event",
      "The Investigator — a modern narrator piecing together the past like a case file",
      "The Elder — a wiser, reflective voice framing the event as a lesson",
      "The Skeptical Historian — questions the “official” version while narrating it",
    ],
    motifs: [
      "Opens with one specific, verifiable detail (a date, a name, a place) before zooming out",
      "A recurring “what actually happened next” pivot midway through each video",
      "Consistent visual treatment marking “recreation” vs. “known fact” moments",
      "Closes by connecting the historical event to something present-day",
    ],
  },
  asmr: {
    label: "Unreal ASMR",
    catchphrases: [
      "Close. Your. Eyes.",
      "Just breathe with this one.",
      "You don't need sound for this — but you'll want it.",
    ],
    archetypes: [
      "The Whisperer — near-silent, intimate narration",
      "The Craftsman — narrates a process (building, cutting, shaping) with quiet precision",
      "The Dreamer — surreal, half-narrated, half-ambient voice",
    ],
    motifs: [
      "A signature repeating sound texture unique to the channel — not generic tapping or whispering",
      "Videos built around one continuous, unbroken action, with no cuts in the “process”",
      "A consistent visual world (same unreal setting or palette) videos keep returning to",
      "No spoken sign-off — every video just fades, never a verbal “see you next time”",
    ],
  },
  story: {
    label: "Story (Scary / Fantasy / Mystery / Sci-Fi / Kids / Bible)",
    catchphrases: [
      "This story isn't finished.",
      "Somebody has to tell you what really happened.",
      "Once this starts, you're staying to the end.",
    ],
    archetypes: [
      "The Storyteller — warm, direct-address narrator who occasionally breaks the fourth wall",
      "The Character-Narrator — tells the story as the protagonist, in first person",
      "The Unreliable Narrator — hints they might not be telling the whole truth",
    ],
    motifs: [
      "A consistent framing device (always “around a fire,” “in a letter,” “found footage”)",
      "A recurring named side-character who appears across otherwise-unrelated stories",
      "A specific narrative tic — always ends on a question, a twist, or a moral",
      "A distinct pacing signature (e.g. a slow build with one hard cut to the climax)",
    ],
  },
  education: {
    label: "Education / Affiliate",
    catchphrases: [
      "Here's the part nobody explains properly.",
      "Skip the fluff — here's what actually matters.",
      "I tested this so you don't have to.",
    ],
    archetypes: [
      "The Practitioner — speaks from hands-on experience, not textbook tone",
      "The Translator — takes something complex and explains it plainly, no jargon",
      "The Honest Reviewer — leads with the downside before the upside",
    ],
    motifs: [
      "Every video follows the same 3-part structure (problem → explanation → next step), stated the same way each time",
      "A recurring “here's what I'd actually do” opinion beat, kept separate from the neutral explanation",
      "Consistent visual chapter markers so a viewer always knows where they are",
      "Closes with one specific, single next action — never a vague “let me know what you think”",
    ],
  },
  localBiz: {
    label: "Local Business Clone (Agency Channels)",
    catchphrases: [
      "Right here in [town].",
      "Meet the people behind [business].",
      "This is why locals keep coming back.",
    ],
    archetypes: [
      "The Neighbor — narrates like a local who already knows the business, not an outside marketer",
      "The Behind-the-Scenes Voice — frames the business through its process or craft, not a sales pitch",
      "The Regular Customer — narrates from the customer's point of view, not the owner's",
    ],
    motifs: [
      "Every video opens with a specific, real local detail (street name, neighborhood, landmark) — never generic",
      "A consistent sign-off naming the business and one concrete reason to visit, stated the same way every time",
      "A recurring visual signature tied to the business's actual branding, not a generic template look",
      "A series structure that rotates through the same few angles (staff, product, customer, story) per business",
    ],
  },
  custom: {
    label: "Something Else / Custom",
    catchphrases: [
      "Whatever this channel's premise is, its catchphrase should reference the specific thing it's about — not the theme category.",
    ],
    archetypes: [
      "Pick or invent a narrator role from your specific premise, not from a generic list — that specificity is the whole point.",
    ],
    motifs: [
      "The strongest motif for a custom concept usually comes straight from what makes your premise different from anything on this list.",
    ],
  },
};

const THEME_ORDER = ["pov", "trivia", "history", "asmr", "story", "education", "localBiz", "custom"];

const TONES = {
  deadpan: { label: "Deadpan & Dry", descriptor: "flat, matter-of-fact delivery — let the content's absurdity or gravity speak for itself, with no forced excitement" },
  warm: { label: "Warm & Cozy", descriptor: "gentle, reassuring, unhurried — like a trusted friend talking directly to the viewer" },
  highEnergy: { label: "High-Energy & Chaotic", descriptor: "fast-paced, punchy, a little unpredictable — short sentences, constant momentum" },
  mysterious: { label: "Mysterious & Moody", descriptor: "measured, deliberate, a little withholding — never over-explain, let pacing and silence carry tension" },
  earnest: { label: "Earnest & Sincere", descriptor: "direct and genuine — no irony, no winking at the camera, say exactly what it means" },
};
const TONE_ORDER = ["deadpan", "warm", "highEnergy", "mysterious", "earnest"];

const HOSTS = {
  none: { label: "No Visible Host (Pure Voiceover)", brief: "No visible host — pure voiceover narration, no on-screen or named character." },
  character: { label: "Recurring Character Persona", brief: null },
  expert: { label: "“Expert” Narrator Persona", brief: null },
};
const HOST_ORDER = ["none", "character", "expert"];

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initGate();
  initTheme();
  initTabs();
  populateSelects();
  initPersonaBuilder();
  initBank();
});

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function initGate() {
  const gate = document.getElementById("gate");
  const form = document.getElementById("gateForm");
  const input = document.getElementById("gatePassword");
  const error = document.getElementById("gateError");
  if (gate.classList.contains("is-unlocked")) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(input.value.trim());
    if (hash === GATE_HASH) {
      localStorage.setItem("voiced_access", "granted");
      gate.classList.add("is-unlocked");
      error.classList.remove("is-visible");
    } else {
      error.classList.add("is-visible");
      input.value = "";
      input.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Theme + tabs
// ---------------------------------------------------------------------------

function initTheme() {
  const toggle = document.getElementById("themeToggle");
  const root = document.documentElement;
  function effectiveTheme() {
    const attr = root.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") return attr;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  toggle.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("voiced_theme", next);
  });
}

function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("is-active"));
      document.getElementById("panel-" + btn.dataset.tab).classList.add("is-active");
    });
  });
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1800);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatSavedAt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function optionsHtml(orderedKeys, dict) {
  return orderedKeys.map((k) => `<option value="${k}">${escapeHtml(dict[k].label)}</option>`).join("");
}

function populateSelects() {
  document.getElementById("pbTheme").innerHTML = optionsHtml(THEME_ORDER, THEMES);
  document.getElementById("pbTone").innerHTML = optionsHtml(TONE_ORDER, TONES);
  document.getElementById("pbHost").innerHTML = optionsHtml(HOST_ORDER, HOSTS);
  document.getElementById("bankTheme").innerHTML = optionsHtml(THEME_ORDER, THEMES);
}

// ---------------------------------------------------------------------------
// Save / reopen — generic helper, one independent history per tool
// ---------------------------------------------------------------------------

function initSaveable({ toolId, listEl, getEntry, applyEntry, max = 50 }) {
  const key = `voiced_saved_${toolId}`;

  const read = () => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  };
  const write = (entries) => {
    localStorage.setItem(key, JSON.stringify(entries.slice(0, max)));
    render();
  };

  function render() {
    const entries = read();
    if (!entries.length) {
      listEl.innerHTML = `<p class="saved-empty">Nothing saved yet — generate a brief, then press Save.</p>`;
      return;
    }
    listEl.innerHTML = entries.map((e) => `
      <div class="saved-item" data-id="${e.id}">
        <div class="saved-item-main">
          <div class="saved-item-name">${escapeHtml(e.name)}</div>
          <div class="saved-item-meta">${escapeHtml(e.meta)} · ${formatSavedAt(e.savedAt)}</div>
        </div>
        <div class="saved-actions">
          <button class="ghost-btn" data-act="open">Open</button>
          <button class="ghost-btn" data-act="delete">Delete</button>
        </div>
      </div>`).join("");
  }

  listEl.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest(".saved-item").dataset.id;
    const entry = read().find((e) => e.id === id);
    if (!entry) return;
    if (btn.dataset.act === "open") {
      applyEntry(entry.payload);
      showToast("Opened");
    } else {
      write(read().filter((e) => e.id !== id));
      showToast("Deleted");
    }
  });

  render();

  return {
    save() {
      const entry = getEntry();
      if (!entry) { showToast("Generate a brief first"); return; }
      write([{ id: Date.now().toString(36), savedAt: new Date().toISOString(), ...entry }, ...read()]);
      showToast("Saved");
    },
  };
}

// ---------------------------------------------------------------------------
// Persona Builder
// ---------------------------------------------------------------------------

const PB_FIELDS = ["theme", "platform", "tone", "host", "character", "motif", "catchphrase", "audience", "avoid"];
const PB_AUTOSAVE_KEY = "voiced_last_persona";

let currentBrief = null; // { persona, text, score } — the last generated result, used by Save

function readPersonaForm() {
  return {
    theme: document.getElementById("pbTheme").value,
    platform: document.getElementById("pbPlatform").value,
    tone: document.getElementById("pbTone").value,
    host: document.getElementById("pbHost").value,
    character: document.getElementById("pbCharacter").value.trim(),
    motif: document.getElementById("pbMotif").value.trim(),
    catchphrase: document.getElementById("pbCatchphrase").value.trim(),
    audience: document.getElementById("pbAudience").value.trim(),
    avoid: document.getElementById("pbAvoid").value.trim(),
  };
}

function writePersonaForm(persona) {
  document.getElementById("pbTheme").value = persona.theme || THEME_ORDER[0];
  document.getElementById("pbPlatform").value = persona.platform || "youtube";
  document.getElementById("pbTone").value = persona.tone || TONE_ORDER[0];
  document.getElementById("pbHost").value = persona.host || HOST_ORDER[0];
  document.getElementById("pbCharacter").value = persona.character || "";
  document.getElementById("pbMotif").value = persona.motif || "";
  document.getElementById("pbCatchphrase").value = persona.catchphrase || "";
  document.getElementById("pbAudience").value = persona.audience || "";
  document.getElementById("pbAvoid").value = persona.avoid || "";
}

const PLATFORM_LABELS = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", multi: "Multi-Platform" };

function generateBriefText(persona) {
  const theme = THEMES[persona.theme] || THEMES.custom;
  const tone = TONES[persona.tone] || TONES.earnest;
  const host = HOSTS[persona.host] || HOSTS.none;
  const platformLabel = PLATFORM_LABELS[persona.platform] || "YouTube";

  let hostLine;
  if (persona.host === "none") {
    hostLine = host.brief;
  } else if (persona.host === "character") {
    hostLine = persona.character
      ? `Recurring character persona — ${persona.character}.`
      : "Recurring character persona — no bio provided yet; add a name and a specific trait or background detail before training the Channel Brain.";
  } else {
    hostLine = persona.character
      ? `"Expert" narrator persona — ${persona.character}.`
      : `"Expert" narrator persona — speaks with hands-on authority on the subject, not textbook tone.`;
  }

  const lines = [];
  lines.push(`CHANNEL BRAIN BRIEF — ${theme.label}`);
  lines.push("");
  lines.push(`Platform: ${platformLabel}`);
  lines.push(`Tone: ${tone.label} — ${tone.descriptor}.`);
  lines.push(`Narrator / Host: ${hostLine}`);
  lines.push(`Target Viewer: ${persona.audience || "[not yet defined — add a specific kind of viewer, not just “fans of " + theme.label + "”]"}`);
  lines.push("");
  lines.push("Brand Voice Instructions:");
  lines.push(`This channel should sound ${tone.descriptor}, and should never default to a generic, interchangeable AI narrator voice.`);
  lines.push(persona.motif
    ? `Signature motif: ${persona.motif}.`
    : `Signature motif: [not yet defined — add one concrete recurring element, a phrase, visual, or structural beat, unique to this channel].`);
  if (persona.catchphrase) {
    lines.push(`Catchphrase: "${persona.catchphrase}".`);
  }
  lines.push("");
  lines.push(persona.avoid
    ? `Avoid: ${persona.avoid}`
    : `Avoid: [not yet defined]`);
  lines.push("");
  lines.push("Paste this brief into MagicFlixAI 2.0's Channel Brain / Brand Voice Training step when setting up this channel.");

  return lines.join("\n");
}

// --- Differentiation Score --------------------------------------------------

function specificityPoints(text, maxPoints, fullAt = 60) {
  const len = (text || "").trim().length;
  if (!len) return 0;
  return Math.min(maxPoints, Math.round((len / fullAt) * maxPoints));
}

function computeRiskScore(persona) {
  const weights = { motif: 30, catchphrase: 15, avoid: 15, audience: 20, character: 20 };
  const motifPts = specificityPoints(persona.motif, weights.motif);
  const catchphrasePts = specificityPoints(persona.catchphrase, weights.catchphrase, 25);
  const avoidPts = specificityPoints(persona.avoid, weights.avoid, 40);
  const audiencePts = specificityPoints(persona.audience, weights.audience, 50);
  const characterPts = persona.host === "none"
    ? Math.round(weights.character * 0.7) // neutral credit — a pure-voiceover channel isn't expected to have a bio
    : specificityPoints(persona.character, weights.character, 50);

  const score = Math.max(0, Math.min(100, motifPts + catchphrasePts + avoidPts + audiencePts + characterPts));

  let band, label;
  if (score < 40) { band = "high"; label = "High generic risk"; }
  else if (score < 70) { band = "medium"; label = "Needs more specifics"; }
  else { band = "low"; label = "Low generic risk — ready to train"; }

  const flags = [];
  if (motifPts < 15) flags.push("Your signature motif is too vague or missing — add one concrete recurring element (a phrase, visual, or structural beat) unique to this channel.");
  if (catchphrasePts < 8) flags.push("No catchphrase set — even a simple one gives viewers something to recognize and repeat.");
  if (avoidPts < 8) flags.push("No Avoid / Off-Limits list — defining what this channel won't do is part of having a real voice, not just what it will.");
  if (audiencePts < 10) flags.push(`Target Viewer is vague — name a specific kind of person, not just "fans of ${(THEMES[persona.theme] || THEMES.custom).label}".`);
  if (persona.host !== "none" && characterPts < 10) flags.push("Character bio is thin — give this narrator a specific trait, background detail, or quirk beyond a name.");

  return { score, band, label, flags };
}

function renderBriefOutput(text) {
  const el = document.getElementById("pbOutput");
  el.innerHTML = `<div class="brief-output">${escapeHtml(text)}</div>`;
}

function renderScoreOutput(result) {
  const el = document.getElementById("pbScore");
  const flagsHtml = result.flags.length
    ? `<ul class="score-flags">${result.flags.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
    : `<ul class="score-flags"><li>No flags — every field carries specific, differentiated detail.</li></ul>`;
  el.innerHTML = `
    <div class="score-band">
      <span class="score-number">${result.score}</span>
      <span class="score-tag risk-${result.band}">${escapeHtml(result.label)}</span>
    </div>
    <div class="score-bar-track"><div class="score-bar-fill risk-${result.band}" style="width:${result.score}%"></div></div>
    ${flagsHtml}
    <p class="score-context">Thousands of MagicFlixAI 2.0 buyers are training their Channel Brain on this exact theme. The theme choice itself won't differentiate you — these specifics are what will.</p>
  `;
}

function autoName(persona) {
  const theme = (THEMES[persona.theme] || THEMES.custom).label;
  if (persona.host !== "none" && persona.character) {
    const namePart = persona.character.split(/[,—-]/)[0].trim();
    if (namePart) return `${namePart} — ${theme}`;
  }
  return `${theme} persona`;
}

// Idea pickers: lets a buyer fill Character Bio / Signature Motif / Catchphrase by
// choosing a ready-made line instead of writing one from scratch — reuses the exact
// same per-theme content as the Voice & Motif Bank, just surfaced right on the field.
const IDEA_PICKERS = [
  { selectId: "pbCharacterIdea", fieldId: "pbCharacter", themeKey: "archetypes" },
  { selectId: "pbMotifIdea", fieldId: "pbMotif", themeKey: "motifs" },
  { selectId: "pbCatchphraseIdea", fieldId: "pbCatchphrase", themeKey: "catchphrases" },
];

function refreshIdeaPickers() {
  const theme = THEMES[document.getElementById("pbTheme").value] || THEMES.custom;
  IDEA_PICKERS.forEach(({ selectId, themeKey }) => {
    const select = document.getElementById(selectId);
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Pick an idea (optional)";
    select.appendChild(placeholder);
    theme[themeKey].forEach((text) => {
      const opt = document.createElement("option");
      opt.value = text;
      opt.textContent = text;
      select.appendChild(opt);
    });
  });
}

function initIdeaPickers(onPick) {
  IDEA_PICKERS.forEach(({ selectId, fieldId }) => {
    const select = document.getElementById(selectId);
    const field = document.getElementById(fieldId);
    select.addEventListener("change", () => {
      if (!select.value) return;
      field.value = select.value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      select.value = ""; // reset to placeholder so the same idea can be picked again later
      onPick();
    });
  });
  document.getElementById("pbTheme").addEventListener("change", refreshIdeaPickers);
  refreshIdeaPickers();
}

function initPersonaBuilder() {
  const fieldIds = { theme: "pbTheme", platform: "pbPlatform", tone: "pbTone", host: "pbHost", character: "pbCharacter", motif: "pbMotif", catchphrase: "pbCatchphrase", audience: "pbAudience", avoid: "pbAvoid" };

  // Restore last in-progress inputs (autosave), independent of the named Saved Personas list.
  try {
    const last = JSON.parse(localStorage.getItem(PB_AUTOSAVE_KEY));
    if (last) writePersonaForm(last);
  } catch { /* ignore malformed autosave */ }

  function autosave() {
    localStorage.setItem(PB_AUTOSAVE_KEY, JSON.stringify(readPersonaForm()));
  }
  Object.values(fieldIds).forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", autosave);
    el.addEventListener("change", autosave);
  });

  initIdeaPickers(autosave);

  function generate() {
    const persona = readPersonaForm();
    const text = generateBriefText(persona);
    const score = computeRiskScore(persona);
    currentBrief = { persona, text, score };
    renderBriefOutput(text);
    renderScoreOutput(score);
  }

  document.getElementById("pbGenerate").addEventListener("click", generate);

  document.getElementById("pbCopy").addEventListener("click", () => {
    if (!currentBrief) { showToast("Generate a brief first"); return; }
    navigator.clipboard.writeText(currentBrief.text).then(
      () => showToast("Copied"),
      () => showToast("Couldn't copy — select and copy manually")
    );
  });

  const saveable = initSaveable({
    toolId: "personas",
    listEl: document.getElementById("pbSavedList"),
    getEntry: () => {
      if (!currentBrief) return null;
      const theme = THEMES[currentBrief.persona.theme] || THEMES.custom;
      return {
        name: autoName(currentBrief.persona),
        meta: `${theme.label} · Score ${currentBrief.score.score}`,
        payload: currentBrief.persona,
      };
    },
    applyEntry: (persona) => {
      writePersonaForm(persona);
      refreshIdeaPickers(); // theme may have changed — keep the pickers' options in sync
      autosave();
      generate();
    },
  });

  document.getElementById("pbSave").addEventListener("click", saveable.save);

  // If a persona was restored from autosave on load, show its brief + score immediately.
  try {
    const last = JSON.parse(localStorage.getItem(PB_AUTOSAVE_KEY));
    if (last && (last.motif || last.audience || last.catchphrase)) generate();
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Voice & Motif Bank
// ---------------------------------------------------------------------------

function renderBank(themeKey) {
  const theme = THEMES[themeKey] || THEMES.custom;
  const grid = document.getElementById("bankGrid");
  const section = (title, items) => `
    <div class="bank-card">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    </div>`;
  grid.innerHTML =
    section("Catchphrase Patterns", theme.catchphrases) +
    section("Narrator Archetypes", theme.archetypes) +
    section("Recurring Motifs", theme.motifs);
}

function initBank() {
  const select = document.getElementById("bankTheme");
  select.addEventListener("change", () => renderBank(select.value));
  renderBank(select.value);
}
