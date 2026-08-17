# Voiced

A free bonus for the MagicFlixAI 2.0 launch. MagicFlixAI 2.0's AI Channel Brain
trains on whatever brand voice you give it — Voiced helps you build that voice
before you sit down to generate your first video.

**Live:** https://voiced.misanmorrison.com

## What it does

- **Persona Builder** — a structured questionnaire (theme, platform, tone,
  narrator/host, signature motif, catchphrase, target viewer, avoid list) that
  compiles a "Channel Brain Brief" ready to paste into MagicFlixAI 2.0's Brand
  Voice Training step. Each of the five open-ended fields has a "Pick an idea"
  dropdown above it — a ready-made, theme-specific line you can use as-is or
  edit, so nobody has to write original English prose to use the tool.
- **Differentiation Score** — a weighted score (0–100) that rates how generic
  vs. differentiated the current persona is, and flags which fields are still
  too vague.
- **Saved Personas** — every finished brief is saved so you can build a
  distinct persona per channel and reopen/tweak any of them later.

## How it's built

Fully static: plain HTML/CSS/JS, no build step, no framework, no AI API calls,
no accounts, no backend. Everything "smart" is a template merged with your
inputs. Anything you save lives only in your own browser's `localStorage` —
nothing is sent anywhere, and nothing is shared across devices.

## Password gate

Voiced is gated behind a password (a SHA-256 hash check, client-side). This is
a **soft deterrent**, not real security — anyone with browser dev tools could
read the hash or the unlock logic. It's there to keep the page off search
engines and out of casual hands, not to protect sensitive data. The page also
carries `<meta name="robots" content="noindex, nofollow">`.

## Hosting

Static site served via GitHub Pages, deployed by `.github/workflows/pages.yml`
on every push to `main`, at the custom domain in `CNAME`.

---

Part of the same bonus-app series as [Landed](https://github.com/miskoblog/landed).
Powered by [Misan Morrison](https://misanmorrison.com/).
