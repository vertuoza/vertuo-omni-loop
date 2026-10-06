---
prd: 1108
title: Pitch studio — animated, on-brand launch videos with per-product Pitch settings
blocked-by: none
spec: file
proof: video
---

# Pitch studio — animated, on-brand launch videos with per-product Pitch settings

**Date:** 2026-10-06 · **PRD:** #1108 · **Follows:** PRD 859 (Pitch a shipped PRD), whose button, Pitch
tab, storage, audiences and `omni pitch push` stay. **Inspired by:** `vertuoza/release-videos`
(storyboard JSON → React scenes → frames in a browser → ffmpeg), whose approach is brought into the
kit without its brand. **Touches:** `kit/lib/pitch/` (storyboard, settings, providers, check, render,
studio), a new `kit/pitch-engine/` (the React engine, built into `kit/dist/pitch-engine/`),
`kit/bin/commands/pitch*.ts`, `kit/build.ts`, `kit/plugin/skills/pitch/SKILL.md`,
`apps/galaxy/src/products/`, `apps/galaxy/app/app/settings/products/`,
`apps/galaxy/app/api/pitch-settings/` (new) and `apps/galaxy/app/api/pitch-look/`, one Supabase
migration, `scripts/import-guard.test.ts` and ADR-0058 for the new zone. **Out of scope:** paid
services of any kind, voice-over, AI music generation (a later provider), editing a storyboard on
the Omni page.

## Problem

PRD 859 shipped the plumbing of a pitch, but the video does not look like a launch: a still slide,
a scrolled screen recording and a bare end card, stitched by ffmpeg, over procedural music. Its own
shipped round says so (persona:B-E DEv, 2/5: "I would not post that to customers"). A team cannot
tailor it either: the only setting is a choice of two looks, with no fonts, no tone, no
instructions, no intro or outro, no music choice. And every outside tool is wired in directly, so
none can be swapped.

## Solution

### 1. Pitch settings, per product

Settings › Products › `<product>` gets a **Pitch** section, replacing the Pitch look dropdown. One
`pitch` JSON value per product, its schema in `kit/lib/pitch/settings.ts`, read by both the CLI and
the Omni page:

```json
{
  "look":   { "colors": { "ink": "#08104D", "paper": "#FFFFFF", "accent": "#3D5AFE", "cta": "#FF4217" },
              "heading": { "provider": "google-fonts", "family": "Gantari", "weight": 700 },
              "text":    { "provider": "google-fonts", "family": "Gantari", "weight": 400 },
              "logo": "asset:logo.svg", "theme": "light" },
  "voice":  { "preset": "confident-warm", "instructions": "Customers' words: worksite, quote, invoice." },
  "intro":  { "eyebrow": "New in Vertuoza" },
  "outro":  { "cta": "Available now", "credits": true },
  "music":  { "provider": "freepd", "mood": "upbeat" },
  "length": { "min": 20, "max": 40 }
}
```

- **Look:** four colour tokens, a **Heading** font (titles) and a **Text** font (description,
  bullets, labels), a logo, and a light or dark theme. A font is a Google Fonts family name or a file
  uploaded to the product. Two presets, **Arcade** and **Keynote** (PRD 859's looks), fill the whole
  section as a starting point.
- **Voice:** a preset — **Confident & warm** (default), **Playful**, **Formal**, **Hype** (inside
  only) — and free **instructions**, at most 600 characters.
- **Intro / outro:** the intro's eyebrow; the outro's call to action and whether credits show.
- **Music:** a provider and its options (see 3).
- **Length:** the video's bounds, 15 to 60 seconds, default 20 to 40.
- Files (logo, fonts) go to a private `pitch-assets` bucket, per product.
- Whoever may edit Settings › Business edits it; any other member reads it.
- `GET /api/pitch-settings?repo=` answers a repository's product settings; `/api/pitch-look` stays
  as an alias that answers `look` alone.

### 2. The storyboard

`storyboard.json` in the run's folder, `{ "storyboard": 1, meta, scenes[] }`, its zod schema in
`kit/lib/pitch/storyboard.ts`:

- **Scenes:** `intro` (eyebrow, the PRD's title, tag), `statement` (one sentence), `feature` (media,
  bullets ≤ 4, layout), `steps` (2–4 steps driving the media), `beforeAfter` (a wipe), `outro`
  (call to action, closing line, credits). Each has a duration of 1 to 20 seconds.
- **Media:** a clip or a screenshot with `start`, `end`, `rate`, `crop`, a `device` frame, and
  keyframed `camera` (zoom 1–4 on a focus point), `callouts` (ring or spotlight, label ≤ 4 words) and
  `cursor` (moves and clicks). Coordinates are 0..1 of the media.
- **Meta:** fps 30, 1920×1080, the transition length, the music and its sync point
  (`{ scene, at }`), and the sources the words came from.

The `/omni:pitch` skill writes it from the spec, the release note, the filmed moments and the
settings: the voice preset and the instructions shape the words; the rules that never move are kept
whatever the instructions say — no number, customer, date or capability absent from the spec and the
release note.

### 3. Providers: every third party behind one interface

`kit/lib/pitch/providers/` holds one interface per kind and a registry. A provider is one file; the
registry names it by `id`:

| kind | interface | providers in this PRD |
|---|---|---|
| `music` | `pick({ mood, seconds }) → { file, licence, credit }` | `none` (silence), `freepd` (CC0 tracks by mood, downloaded on demand), `file` (a file the product uploaded) |
| `fonts` | `load({ family, weight }) → { css, files }` | `google-fonts`, `file` |
| `capture` | `frames(page, count) → images` | `playwright` |
| `encode` | `video(frames, audio, shape) → file` | `ffmpeg` |

- Adding a provider is one file and one registry line; removing one is deleting its file. A setting
  naming a provider that is no longer registered falls back to the kind's default (`none`, a system
  font) with one line.
- No provider's name appears outside its own file and the registry.
- Everything is free: no account, no API key, no paid service.

### 4. Filmed moments

The walk-through is still filmed on production, signed in, and never changes anything there. It now
also writes `moments.json`: for each step, its time in the clip and the box of the element it acts
on. The storyboard's camera, callouts and cursor come from it, never from guessed coordinates.

### 5. The engine, the studio and the render

- `kit/pitch-engine/` is a small frame-driven React runtime — easings and springs, `interpolate`,
  scene timeline with crossfade overlaps, media with camera, callouts and cursor — and the six scene
  templates. Every frame is a pure function of its number. Motion: titles built word by word (spring,
  blur to sharp), a 3D media card that settles over the scene, log-space camera zooms clamped so no
  edge shows, callouts that follow the camera, a cursor with a click ripple, a before/after wipe,
  a slowly drifting background. Colours and fonts come only from the look.
- `pnpm kit:build` builds it into a static page, `kit/dist/pitch-engine/`. A repository using the kit
  needs no React and no Vite: only Playwright and ffmpeg, as today.
- `omni pitch check <dir>`: the schema, word counts, reading time, every media present, intro first
  and outro last. Errors stop; warnings print and are written to `pitch.json`.
- `omni pitch studio <dir>`: a local server opens the page with play, frame and scene keys, and
  reloads when the storyboard changes.
- `omni pitch render <dir> [--stills]`: frames through the `capture` provider, encoded by the
  `encode` provider into `pitch.mp4` (1920×1080), `pitch-square.mp4` (1080×1080) and `pitch.gif`
  (≤ 8 s, 640 px); `--stills` writes one settled frame per scene and a contact sheet.
- The music is fetched through its provider, normalised, faded in and out, and placed so its sync
  point lands on the storyboard's key moment.
- `omni pitch push` and the Pitch tab are unchanged.

### 6. What goes away

PRD 859's still slide, slide-to-clip stitching and procedural music. `omni pitch slide` and
`omni pitch music` are removed; `omni pitch video` becomes `omni pitch render`.

## Decisions

- **One PRD for the settings and the video** (asked): the settings exist to shape the video.
- **The engine lives in the kit, generic, with no brand** (asked): a product's brand is its look —
  colours, Heading and Text fonts, logo — set on the Omni page; the kit carries no brand and no font.
- **Every third party is a provider** (asked): music, fonts, capture and encoding behind one
  interface each, dropped or replaced by one file.
- **Free only** (asked): no paid service; music from FreePD (CC0, public domain, no credit), a
  product's own file, or none. Spotify's developer terms forbid putting its recordings in a video;
  Instagram's music rests on platform licences we cannot reuse.
- **Heading and Text fonts** (asked), each a Google Fonts family or an uploaded file.
- **Voice presets plus instructions** (asked), the never-invent rules above both.
- **A built page, not Vite at runtime** (taken here): the kit ships as one bundle, so the engine is
  built with it and served by a small local server.
- **The voice's objection** (persona:F-E Developer, "a React render engine inside a CLI kit is a big
  surface; a broken or blurry render is slop my team ships"): settled `accepted` — `omni pitch check`
  blocks a bad storyboard, `--stills` gives a per-scene review before any full render, and the engine
  is tested at fixed frames.
- **Proof video** (asked): yes.

## User stories

- As a PM, I press Pitch on a shipped PRD and get a 20–40 second video that opens on the PRD's title,
  says what it does, shows the feature with zooms on what matters, and closes with our call to action.
- As a product owner, I set our colours, Heading and Text fonts, logo, tone and instructions once in
  Settings › Products › Pitch, and every pitch follows them.
- As the person making a pitch, I preview it in the studio and look at one image per scene before
  the full render.
- As a developer, I swap the music source, or add one, by writing one provider file.
- As a team with no budget, I make pitches with free music and fonts only.

## Scope

**In:** the Pitch settings (schema, migration from `pitch_look`, page, API, assets), the storyboard
schema, the providers and registry with the six providers above, filmed moments, the engine and its
six scenes, `check`, `studio`, `render`, the skill rewritten around the storyboard, the new import
zone, the removal of the still slide and procedural music.

**Out:** paid music or font services, AI music generation, voice-over, editing a storyboard on the
Omni page, more scene types than the six.

## Test seams

Following `omni kb show testing`: tests beside the code, pure units first.

1. Storyboard and settings schemas: valid and invalid fixtures, each refusal with its message.
2. `omni pitch check`: word counts, reading time, scene order, missing media.
3. Engine units: easings, springs, `interpolate`, camera zoom (log space, clamping), the timeline,
   a title word's reveal at a given frame.
4. Engine render: a fixture storyboard rendered at fixed frames (the intro at 0.5 s, a camera zoom at
   its peak, the outro), compared with reference images within a small tolerance.
5. Providers: one contract test every registered provider passes; `freepd` and `google-fonts`
   against fakes at the network boundary; a test that no provider name appears outside its file and
   the registry.
6. Settings: the API and its alias, the page (an editor edits, another member reads), the migration
   from `pitch_look`.
7. Moments: a walk-through of a local test page writes boxes that match its elements.
8. A full run on a fixture: `render --stills` then `render` give the three files at the right sizes
   and lengths, with an audio track when music is not `none`.

## Risks

- **What merging publishes** (`omni kb show releasing`): a kit release with the new `pitch` verbs and
  the engine page, one Supabase migration (`products.pitch`, the `pitch-assets` bucket) applied on
  merge, and the galaxy app's new settings page. Rollback: revert the PR; the migration keeps
  `pitch_look` until a later PRD drops it, so the previous app still reads it.
- **A new import zone** (`kit/pitch-engine` may import React and `kit/lib`): the boundary table,
  ADR-0058 and `scripts/import-guard.test.ts` change together.
- **Bundle size**: the engine page adds to the kit's release; it is built once and only loaded by
  `studio` and `render`.
- **Fonts and music fetched at run time** depend on the network; each falls back as section 3 says.
- **Render time** grows with frames (about 900 for 30 seconds); capture runs in parallel pages.
- **Filming production** stays read-only, as in PRD 859.

## Acceptance criteria

1. Settings › Products › `<product>` shows a **Pitch** section with Look (colours, Heading font, Text
   font, logo, theme), Voice (preset, instructions), Intro / outro, Music and Length; choosing the
   Keynote preset fills the Look; an editor's change stays after a reload, and another member sees
   it with no controls.
2. `GET /api/pitch-settings?repo=` answers the product's settings, and `/api/pitch-look` still answers
   its look.
3. A product's existing `pitch_look` appears as the matching preset after the migration.
4. `omni pitch check` refuses a storyboard with a missing media file or no outro, naming each, and
   warns on a title over 9 words.
5. `omni pitch render <dir> --stills` writes one image per scene and a contact sheet.
6. `omni pitch render <dir>` writes `pitch.mp4` (1920×1080, within the settings' length, with an audio
   track when music is not `none`), `pitch-square.mp4` (1080×1080) and `pitch.gif` (≤ 8 s, 640 px wide).
7. The intro shows the PRD's title built word by word in the Heading font, and a feature scene zooms
   the camera on the element its moment names.
8. With music `freepd` and mood `upbeat`, the video carries a CC0 track and `pitch.json` records its
   licence; with a provider name that is not registered, the render is silent and says so in one line.
9. Removing a provider's file and its registry line leaves every other test green.
10. `omni pitch studio <dir>` serves the storyboard and reloads when it changes.
11. The slide's words hold no number, name or capability absent from the spec and the release note,
    whatever the instructions say.
