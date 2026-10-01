---
prd: 859
title: Pitch a shipped PRD
blocked-by: none
spec: file
proof: video
---

# Pitch a shipped PRD

**Date:** 2026-10-01 · **PRD:** #859 · **Next:** PRD B, Settings › Products › Voices (uploaded or AI
music, optional narration, Spotify later), brainstormed after this one ships.
**Touches:**
- `supabase/migrations/` (one new file: `products.pitch_look`, the `pitches` bucket, `pitch_runs`),
  `supabase/checks/pitch.sql` (new)
- `apps/galaxy/app/app/settings/products/` (new list and `[id]` pages), `apps/galaxy/src/products/`
  (new), `apps/galaxy/src/nav/section-tabs.ts` (a Products tab)
- `apps/galaxy/src/dossier/page/` (the Pitch button in the stage header, a Pitch tab, `PitchPane.tsx`)
- `apps/galaxy/app/api/pitches/` (new: uploads, register, the GIF's stable link), `apps/galaxy/src/pitch/` (new)
- `kit/bin/commands/pitch.mjs` and `kit/lib/pitch/` (new: slide templates, music, ffmpeg recipe, push)
- `kit/plugin/skills/pitch/SKILL.md` (new), the help entry for `/omni:pitch`

## Problem

When a PRD ships, nobody outside the people who built it finds out in a way they want to watch. The
release note is one paragraph in a folder; the proof clips (PRD 798) are test-shaped — three fast
seconds per criterion, no story, no sound. To announce a feature to customers, or to the company at
an all-hands, someone has to hand-make a slide, screen-record the feature, find music and cut a video.
That takes an afternoon, so it happens for almost nothing.

Not every PRD deserves a launch. Making one must be a choice someone takes on a shipped PRD, never a
step every PRD pays for.

## Solution

**1. Settings › Products.** A new Settings tab, **Products**, after Business, lists the workspace's
products (the ones Settings › Business already holds). Each opens its own page,
`/app/settings/products/<id>`, with one section for now:

- **Pitch look**, a dropdown: **Arcade poster** (the default, Omni Loop's own look: starfield, Anton
  italic in yellow with a red drop shadow, a pixel kicker, the screen in a hard-edged frame) or
  **Clean keynote** (light background, heavy sans headline, a plasma tag, a soft floating screen).
  *Custom* is named nowhere yet; a later PRD adds it.
- Whoever may edit Settings › Business may change it; anyone else in the workspace reads it.

The look is **per product, never per workspace**: two products of one workspace pitch in two looks.
A PRD's product is the product of the repository it was built in.

**2. The Pitch button.** On a PRD's page whose stage is **shipped** or **retro**, the stage header's
action is **Pitch**. It opens a small panel:

- Two choices, **Customers** (selected first) and **Inside**.
- The command for that choice, `/omni:pitch <n> --for customers` or `--for inside`, with Copy.
- One line: "Run it in Claude Code, in this repository. The pitch shows on the Pitch tab."

At any earlier stage there is no Pitch button. The demo shows the panel, disabled.

**3. `/omni:pitch <n> --for customers|inside`**, a new skill, run on the person's computer:

1. **Refuse** with one line, writing nothing, when the PRD is not shipped
   (`PRD <n> is not shipped: a pitch is for shipped PRDs`), when `proof.url` is not a fixed URL (the
   proof skill's line), when `ffmpeg` is not on the PATH
   (`ffmpeg is needed for a pitch: brew install ffmpeg`), or when `omni signin` has no session
   (`no sign-in (omni signin)`).
2. **The words.** From the PRD's `release.md` and its spec only, Claude writes, for the audience:
   a **hook** (at most 10 words), a **benefit** (at most 25 words), a **kicker** (`NEW IN <PRODUCT>`
   for Customers, `SHIPPED · PRD <n>` for Inside) and a **closing line** (Customers: the product's
   name and its home link; Inside: `#<feature PR> · v<version> · built by the loop`). It never
   writes a number, a customer name or a capability the spec and release note do not state.
3. **The walk-through.** One Playwright script, written beside the run like `/omni:prove`'s, walks the
   feature on `proof.url` with the person's `omni proof session` sign-in: 10 to 15 seconds,
   1920×1080, clicks slowed so a viewer can follow, a visible cursor drawn on the page. It films
   only; it asserts nothing, and it never saves, deletes or changes anything on production (it may
   open, hover, scroll and fill a field it then leaves).
4. **The slide.** `omni pitch slide` renders the wedge slide from the product's look, the words and
   one real frame of the walk-through (never a drawn screen), as `slide.png` (1920×1080) and
   `slide-square.png` (1080×1080).
5. **The music, default voice.** `omni pitch music --for <audience>` writes a 30-second WAV the kit
   generates in code, the same bytes every time for an audience: a chiptune loop for Inside, an
   upbeat synth loop for Customers. No file to license, no key.
6. **The video.** `omni pitch video` runs ffmpeg once per shape: the slide card (3 s), the walk-through,
   a closing card (3 s) drawn in the same look, music under it with a one-second fade in and out, cut
   to the video's length: `pitch.mp4` (1920×1080) and `pitch-square.mp4` (1080×1080, the walk-through
   centred on the look's background), both H.264 with AAC audio, 20 to 30 seconds. And
   `pitch.gif`: the walk-through only, silent, at most 8 seconds, 640 pixels wide.
7. **The run** writes `pitch.json` in the run folder under `worktrees`: `{prd, audience, look,
   commit, hook, benefit, kicker, closing, files}`, and nothing in the repository's tracked tree.
8. **Push.** `omni pitch push <n> <dir>` uploads the files and registers the run. Exit 0 prints the
   Pitch tab's link and the GIF's stable link; exit 1 prints one line (`none`, `off`,
   `no sign-in (omni signin)`, `unreachable`, `refused (<status>)`, or `not shipped`), keeps every
   file, and the skill prints `upload failed: rerun omni pitch push <n> <dir>`. It never retries.

The skill posts no comment anywhere and changes no PR, issue or label.

**4. The Pitch tab.** A PRD with at least one pitch has a **Pitch** tab after Proof. It shows the
latest pitch per audience, Customers first, each with: the slide, the 16:9 video's player, and
downloads for `slide.png`, `slide-square.png`, `pitch.mp4`, `pitch-square.mp4` and `pitch.gif`, plus
**Copy GIF link** (the stable link, which opens without signing in, like Proof's). A picker per
audience lists older pitches by date. A PRD with none has no tab.

## Decisions

- **Made on the person's computer, not the server.** The button copies a command, like
  `--rework` and `/omni:prove`. It reuses Playwright, ffmpeg and the person's sign-in; the server
  gains no renderer, no model key and no queue. (Asked; chosen.)
- **Its own walk-through, not the proof clips.** Proof clips are fast assertions; a pitch needs one
  slow, continuous take. (Asked; chosen.)
- **Package:** wedge PNG, MP4 with music in 16:9 and 1:1, and a silent GIF. (Asked; the GIF added back
  at the design review.)
- **Look per product, on a page of its own.** Settings › Products › `<product>` holds it, so PRD B's
  voices land on the same page. (Asked; the person insisted on per product, never per workspace.)
- **Two looks, Arcade poster by default.** Chosen from five drawn directions (arcade, keynote, split
  gradient, one big word, launch ticket); *Custom* is a later PRD.
- **Default music generated in code.** Bundled tracks would need a licence check for every file;
  generated ones need none. PRD B adds uploads, AI music and narration per product and audience.
- **The voice objected** (persona:B-E DEv): a pitch that shows a screen or a number not really in
  production makes the tool fluff. Settled **accepted**: the slide's screen is a real frame of the
  walk-through, and the words come only from the spec and the release note, with no invented numbers.
- **Shipped and retro only**, checked twice: the button is drawn only at those stages, and
  `pitch_run_add()` refuses any other dossier.

## User stories

- As Irisa, a PM, once my mobile quick win ships, I tick Customers, paste one command, and have a
  slide and a 25-second video to send to the customer who asked for it.
- As Paul, a product manager, I make an Inside pitch for the all-hands in the time it takes to make a
  coffee.
- As the lead engineer, I see on the PRD's page what was announced and to whom.
- As a workspace with two products, each pitches in its own look.

## Scope

**In:** Settings › Products (list + one page per product, Pitch look); the Pitch button and panel on
shipped and retro PRDs; `/omni:pitch` with its `omni pitch slide|music|video|push` verbs; the two
looks in both shapes; generated default music for both audiences; the `pitches` bucket and
`pitch_runs`; the Pitch tab.

**Out:** voices (uploaded or AI music, narration, Spotify) — PRD B; a Custom look; server-side
rendering; posting the pitch anywhere (Slack, LinkedIn); a pitch for a fix (visual or bug); editing a
pitch's words on the page.

## Test seams

Following `omni kb show testing`: tests beside the code, vitest, never GitHub or Supabase.

- `kit/lib/pitch/slide`: each look in each shape draws the kicker, hook, benefit and frame, at the
  shape's size, with no text box overflowing (Playwright on a fixture frame).
- `kit/lib/pitch/music`: the same audience gives the same bytes; the WAV is 30 s, 44.1 kHz, stereo.
- `kit/lib/pitch/ffmpeg`: the recipe is a pure function of the files and lengths; the cards, fades and
  cut length are in the arguments.
- `kit/bin/commands/pitch`: each refusal prints its line and writes nothing; `push` prints each exit-1
  line on a stubbed app.
- `supabase/checks/pitch.sql`: `pitch_run_add()` refuses a dossier not shipped or retro, a file
  outside the run's folder and a stranger; a member reads, a non-member reads nothing;
  `set_pitch_look()` refuses someone who may not edit Business.
- Galaxy: the Products list and page (editor and reader); the Pitch action only on shipped and retro;
  the panel's command per choice; the Pitch tab empty (no tab), one pitch, two per audience (picker).

## Risks

Merging publishes a migration (a column, a bucket, a table, three functions), two Settings pages, a
tab, a stage action, a skill and five CLI verbs, in the next `v0.0.N`. Rollback: revert the feature
PR and run a follow-up migration dropping `pitch_runs`, its functions, `products.pitch_look` and,
once emptied, the bucket; nothing else reads them. The walk-through runs against production with the
person's sign-in: the skill forbids any save, delete or change, and the script is kept beside the
run for anyone to read.

## Acceptance criteria

1. Settings has a **Products** tab after Business; it lists the workspace's products, and each opens
   `/app/settings/products/<id>` with a **Pitch look** dropdown showing Arcade poster by default.
2. Someone who may edit Settings › Business changes a product's look to Clean keynote and it stays
   after a reload; another product of the same workspace keeps Arcade poster.
3. A workspace member who may not edit Business sees the look and no dropdown.
4. A shipped PRD's page shows **Pitch** in its header; it opens a panel with Customers and Inside,
   and the shown command changes from `/omni:pitch <n> --for customers` to `--for inside`.
5. A PRD in the inbox, building or outbox stage shows no Pitch button.
6. `/omni:pitch <n>` on a PRD not shipped prints `PRD <n> is not shipped: a pitch is for shipped
   PRDs` and writes nothing; without ffmpeg it prints the ffmpeg line.
7. A run writes `slide.png` (1920×1080), `slide-square.png` (1080×1080), `pitch.mp4` (1920×1080,
   20–30 s, with an audio track), `pitch-square.mp4` (1080×1080) and `pitch.gif` (≤ 8 s, 640 px wide),
   in the product's look.
8. The slide's hook, benefit and kicker hold no number, name or capability absent from the spec and
   release note.
9. After `omni pitch push`, the PRD's page has a **Pitch** tab showing the slide, the video and the
   five downloads, and Copy GIF link gives a link that opens without signing in.
10. A second pitch for the same audience becomes the shown one, and the first stays in the picker.
11. `pitch_run_add()` refuses a dossier that is not shipped or retro.
