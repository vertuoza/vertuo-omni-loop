# Plan: Pitch studio — animated, on-brand launch videos with per-product Pitch settings

PRD #1108, spec beside this plan (`spec.md`). The feature branch `feat/pitch-studio` merges into
`main` with `Closes #1108`. Each slice is a sub-PR from `feat/pitch-studio--<slice>` into
`feat/pitch-studio`, its body opening with `Part of #1108`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A product holds its Pitch settings: the shared schema, one migration from `pitch_look` to `pitch` with the `pitch-assets` bucket, and `GET /api/pitch-settings?repo=` with `/api/pitch-look` kept as its alias | `kit/lib/pitch/settings` `supabase/migrations/20261107090000_pitch_settings` `supabase/checks/pitch_settings.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` `apps/galaxy/app/api/pitch-settings/` `apps/galaxy/app/api/pitch-look/` `apps/galaxy/src/products/pitch-settings-api` `apps/galaxy/src/products/pitch-look-api` `apps/galaxy/src/products/pitch-look-live` `apps/galaxy/src/products/store` | — | 1 |
| s3 | A storyboard has a schema and a check: `omni pitch check <dir>` refuses a storyboard with a schema error, a missing media file or a wrong scene order, naming each, and warns on word counts and reading time | `kit/lib/pitch/storyboard` `kit/lib/pitch/check` `kit/bin/commands/pitch-make` `kit/bin/commands/pitch.ts` `kit/lib/help/entries` `kit/dist/omni.mjs` | — | 1 |
| s5 | Every outside tool is a provider: the interfaces and the registry, music `none`, `freepd` and `file`, fonts `google-fonts` and `file`, capture `playwright`, encode `ffmpeg`, a contract test every provider passes, and a guard that no provider name leaks outside its file and the registry | `kit/lib/pitch/providers/` `kit/lib/pitch/music` `kit/lib/pitch/ffmpeg` | — | 1 |
| s2 | Settings › Products › `<product>` shows the Pitch section — Look (preset, colours, Heading and Text fonts, logo, theme), Voice (preset, instructions), Intro / outro, Music, Length — an editor saves it and uploads a logo or a font, another member reads it | `apps/galaxy/src/products/ProductPage` `apps/galaxy/src/products/model` `apps/galaxy/src/products/load` `apps/galaxy/src/products/render.test.ts` `apps/galaxy/src/products/route-view` `apps/galaxy/src/products/products.css` `apps/galaxy/src/products/pitch-form` `apps/galaxy/app/app/settings/products/` `apps/galaxy/app/api/pitch-assets/` | s1 | 2 |
| s4 | The engine renders a storyboard frame by frame in a browser: the runtime (easings, springs, interpolate, timeline, camera, callouts, cursor), the six scenes in the look's colours and fonts, built by `pnpm kit:build` into `kit/dist/pitch-engine/`, in a new import zone the guard and ADR-0058 allow | `kit/pitch-engine/` `kit/build.ts` `kit/dist/pitch-engine/` `package.json` `pnpm-lock.yaml` `scripts/import-guard.test.ts` `.omni-loop/knowledge/adr/0058-` `.omni-loop/knowledge/playbook/architecture.md` `eslint.config.ts` `tsconfig.json` | s3 | 2 |
| s6 | `omni pitch render <dir> [--stills]` and `omni pitch studio <dir>`: frames through the capture provider, music through its provider placed on the sync point, encoded into `pitch.mp4`, `pitch-square.mp4` and `pitch.gif`, stills and a contact sheet, and a studio that reloads on change; PRD 859's still slide and procedural music go away | `kit/lib/pitch/render` `kit/lib/pitch/studio` `kit/lib/pitch/slide` `kit/lib/pitch/run` `kit/bin/commands/pitch-make` `kit/bin/commands/pitch.ts` `kit/lib/help/entries` `kit/test/fixtures/pitch/` `kit/dist/omni.mjs` | s3, s4, s5 | 3 |
| s7 | `/omni:pitch` makes the video from the settings: `omni pitch start` reads the product's Pitch settings, the walk-through writes `moments.json`, and the skill writes the storyboard from the spec, the release note, the moments, the voice preset and the instructions, never inventing, then checks, reviews the stills, renders and pushes | `kit/lib/pitch/moments` `kit/lib/pitch/run` `kit/bin/commands/pitch-make` `kit/plugin/skills/pitch/` `kit/lib/help/entries` `kit/dist/omni.mjs` | s1, s6 | 4 |

**Shared ground.**

- `kit/dist/omni.mjs`, the bundle `kit/test/dist.test.ts` checks against a fresh build: s3, s6 and s7
  change the CLI and declare it (waves 1, 3 and 4). s5's providers are reached from the CLI only
  through s6, so s5 leaves the bundle unchanged.
- `kit/bin/commands/pitch-make`, `kit/bin/commands/pitch.ts` and `kit/lib/help/entries`: s3 adds
  `check`, s6 adds `render` and `studio` and removes `slide`, `music` and `video`, s7 changes `start`
  (waves 1, 3 and 4).
- `kit/lib/pitch/run`: s6 removes the still-slide steps, s7 adds the settings read (waves 3 and 4).
- `apps/galaxy/src/products/store`: s1 writes the `pitch` value; s2 calls it and is blocked by s1.
- `kit/lib/pitch/music` and `kit/lib/pitch/ffmpeg`: s5 moves them behind providers; s6 uses them
  only through the registry.
- The migration's timestamp must sort after the newest migration on `main` when s1 is built; s1
  renames it if `main` moved past it.

## Per slice: done when

**s1**
- `kit/lib/pitch/settings` parses the spec's example, fills defaults, and refuses a bad colour, a
  length outside 15–60 s, instructions over 600 characters and an unknown voice preset, each with its
  message.
- After the migration, a product's `pitch_look` reads as the matching preset (spec acceptance 3);
  `pitch_look` is kept; `supabase/checks/pitch_settings.sql` passes in the workflow.
- `GET /api/pitch-settings?repo=` answers the product's settings and `/api/pitch-look` still answers
  its look (spec acceptance 2), with tests at the route.

**s3**
- Spec acceptance 4: `omni pitch check` exits 1 naming a missing media file and a missing outro,
  exits 0 with a warning for a title over 9 words, and writes its warnings to `pitch.json`.
- The storyboard schema accepts a fixture holding all six scene types and refuses each malformed
  field with its path.
- `omni help pitch` names `check`.

**s5**
- Every registered provider passes one contract test for its kind.
- `freepd` picks a CC0 track for a mood and returns its licence, against a faked network; `none`
  returns silence; `file` returns the product's uploaded file.
- `google-fonts` and `file` return CSS and files for a family and weight, against a faked network.
- A provider name not in the registry falls back to the kind's default, with one line.
- Spec acceptance 9: removing one provider's file and its registry line leaves every other test
  green; a test fails when a provider's name appears outside its file and the registry.

**s2**
- Spec acceptance 1: the Pitch section shows Look, Voice, Intro / outro, Music and Length; choosing
  Keynote fills the Look; an editor's change stays after a reload; another member sees it with no
  controls. Render and route tests beside the page.
- An editor uploads a logo and a font file to `pitch-assets`; another member cannot.

**s4**
- Engine unit tests: easings, springs, `interpolate`, camera zoom in log space and clamped, the
  timeline's overlaps, a title word's state at a given frame.
- A fixture storyboard rendered at fixed frames (intro at 0.5 s, a camera zoom at its peak, the
  outro) matches reference images within a small tolerance.
- `pnpm kit:build` writes `kit/dist/pitch-engine/`; the import guard allows `kit/pitch-engine` to
  import React and `kit/lib` and nothing else, and ADR-0058 and the architecture form's boundary
  table say so.
- Colours and fonts come only from the look: a test renders the same frame in two looks and finds
  each look's colours.

**s6**
- Spec acceptance 5 and 6: on the fixture, `render --stills` writes one image per scene and a contact
  sheet; `render` writes `pitch.mp4` (1920×1080, within the length, with audio when music is not
  `none`), `pitch-square.mp4` (1080×1080) and `pitch.gif` (≤ 8 s, 640 px wide), checked with ffprobe.
- Spec acceptance 8: with `freepd` the video has an audio track and `pitch.json` records the licence;
  with an unregistered provider the render is silent and says so in one line.
- Spec acceptance 10: `omni pitch studio <dir>` serves the storyboard and reloads when it changes.
- `omni pitch slide`, `music` and `video` are gone, with their tests; `omni help pitch` lists the
  verbs that remain.

**s7**
- `omni pitch start` writes the product's Pitch settings into the run's folder, or the Keynote preset
  with one line when they cannot be read.
- A walk-through of a local test page writes `moments.json` whose boxes match its elements.
- Spec acceptance 7: on the fixture, the intro shows the PRD's title word by word in the Heading
  font, and the feature scene's camera zooms on the element its moment names.
- Spec acceptance 11: the skill says the words come only from the spec and the release note whatever
  the instructions say, and a test over the skill's text keeps that rule present.
- The skill runs check, then stills it looks at, then render, then push.
