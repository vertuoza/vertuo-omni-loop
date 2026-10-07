# Plan: Pitch a shipped PRD

PRD #859, specified in `spec.md` beside this plan. Built on the feature branch `feat/pitch` into
`main`, whose feature PR says `Closes #859`; each slice is a sub-PR from `feat/pitch--<slice>` into
the feature branch, saying `Part of #859`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Settings › Products: a Products tab after Business lists the workspace's products, each opens `/app/settings/products/<id>` with a Pitch look dropdown (Arcade poster by default, or Clean keynote) that a Business editor changes per product and anyone else reads; `GET /api/pitch-look?repo=` answers the look of a repository's product | `supabase/migrations/20261101090000_products_pitch_look*` `supabase/checks/products_pitch_look.sql` `.github/workflows/supabase.yml` `apps/galaxy/src/products/` `apps/galaxy/app/app/settings/products/` `apps/galaxy/app/api/pitch-look/` `apps/galaxy/src/nav/section-tabs.ts` `apps/galaxy/src/nav/SectionTabs.render.test.ts` `apps/galaxy/src/nav/AppBar.test.ts` `apps/galaxy/src/nav/sidebar.test.ts` `apps/galaxy/src/business/render.test.ts` `apps/galaxy/src/fleets/render.test.ts` `apps/galaxy/src/jev/settings/render.test.ts` `apps/galaxy/src/repositories/render.test.ts` | — | 1 |
| s2 | The Pitch button: a PRD's page at stage shipped or retro shows Pitch in its header, opening a panel with Customers and Inside whose command reads `/omni:pitch <n> --for customers` or `--for inside`, with Copy; every earlier stage shows no Pitch button, and the demo shows the panel disabled | `apps/galaxy/src/dossier/page/stage.ts` `apps/galaxy/src/dossier/page/stage.test.ts` `apps/galaxy/src/dossier/page/StageHeader.tsx` `apps/galaxy/src/dossier/page/PitchAction` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/dossier.css` | — | 1 |
| s3 | Pitch storage and tab: `omni pitch push <n> <dir>` uploads a run's slide, videos and GIF to the private `pitches` store and registers it (refused for a dossier not shipped or retro, each exit-1 line printed as is), and the PRD's page gains a Pitch tab after Proof with the latest pitch per audience, its slide, player, five downloads, Copy GIF link (opens without signing in) and a picker of older pitches | `supabase/migrations/20261101100000_pitch_runs*` `supabase/checks/pitch.sql` `.github/workflows/supabase.yml` `apps/galaxy/app/api/pitches/` `apps/galaxy/src/pitch/` `apps/galaxy/src/dossier/page/PitchPane` `apps/galaxy/src/dossier/page/pitch` `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/DossierRoute.tsx` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/dossier.css` `kit/bin/commands/pitch` `kit/bin/commands/index.mjs` `kit/lib/commands.mjs` `kit/lib/pitch/push` `kit/dist/omni.mjs` | s1, s2 | 2 |
| s4 | `/omni:pitch <n> --for <audience>` (customers or inside) makes the package: it refuses a PRD not shipped, a missing ffmpeg, a `proof.url` that is not fixed and no sign-in, each with its line; writes the words from the spec and release note only; films one 10–15 s walk-through on production; renders the wedge slide in the product's look in 16:9 and 1:1 from a real frame; generates the audience's default music; builds `pitch.mp4`, `pitch-square.mp4` and `pitch.gif` with ffmpeg; writes `pitch.json`; and pushes | `kit/lib/pitch/slide` `kit/lib/pitch/music` `kit/lib/pitch/ffmpeg` `kit/lib/pitch/run` `kit/bin/commands/pitch` `kit/bin/commands/index.mjs` `kit/lib/commands.mjs` `kit/plugin/skills/pitch/` `kit/lib/help/entries` `kit/test/plugin.test.mjs` `kit/dist/omni.mjs` | s1, s3 | 3 |

**Shared ground.**
- `.github/workflows/supabase.yml` (one step per SQL check file): s1 and s3, waves 1 and 2.
- `apps/galaxy/src/dossier/page/render.test.ts` and `dossier.css`: s2 (the Pitch action and panel)
  and s3 (the Pitch tab), waves 1 and 2.
- The kit's command wiring, `kit/bin/commands/pitch*`, `kit/bin/commands/index.mjs`,
  `kit/lib/commands.mjs` and the built `kit/dist/omni.mjs`: s3 makes `omni pitch` with its `push`
  verb, s4 adds `slide`, `music` and `video`; waves 2 and 3. Each rebuilds the bundle with
  `pnpm kit:build`.
- The Settings tab row is read by every Settings screen's render test (business, fleets, jev,
  repositories) and by the nav tests: s1 alone changes them.
- Migration file names are fixed here so the slices never clash, and after PRD 855's reserved
  20261028* names; check the newest migration on `main` before the feature PR merges (#771), and
  rename when one landed after 20261029100000.

## Per slice: done when

**s1**
- Settings shows Products after Business; it lists the workspace's products, each linking to its
  own page.
- A Business editor changes a product's look to Clean keynote; it holds after a reload, and another
  product keeps Arcade poster. A member who may not edit Business sees the look and no dropdown.
- `supabase/checks/products_pitch_look.sql`: `set_pitch_look()` refuses a stranger and a value other
  than `arcade` or `keynote`; the default is `arcade`.
- `GET /api/pitch-look?repo=<owner/name>` answers `{look}` for a tracked repository's product, and
  `arcade` for a repository with no product.

**s2**
- `stage.test.ts`: the action is Pitch at shipped and retro, and none of idea, PRD, inbox, building
  and outbox shows it.
- `render.test.ts`: the panel shows Customers selected first and `/omni:pitch <n> --for customers`;
  choosing Inside shows `--for inside`; Copy carries the shown command. The demo's panel is disabled.

**s3**
- `supabase/checks/pitch.sql`: `pitch_run_add()` refuses a dossier not shipped or retro, a file
  outside the run's folder, a stranger, and an audience other than customers or inside; a member
  reads the runs, a non-member none.
- `omni pitch push` on a fixture run against a stubbed app uploads the five files and prints the
  Pitch tab's link and the GIF's stable link; each of `none`, `off`, `no sign-in (omni signin)`,
  `unreachable`, `refused (<status>)` and `not shipped` prints as one line with exit 1 and keeps the
  files.
- `render.test.ts`: no Pitch tab without a pitch; one pitch shows the slide, the player, the five
  downloads and Copy GIF link; two pitches for one audience show the newer and a picker with both.
- The GIF's stable link answers without a session.

**s4**
- Each refusal prints its line and writes nothing (not shipped, no ffmpeg, `proof.url` not fixed,
  no sign-in).
- `slide`: each look in each shape draws the kicker, hook, benefit and the frame at 1920×1080 or
  1080×1080 with no text box overflowing.
- `music`: the same audience gives the same bytes; the WAV is 30 s, 44.1 kHz, stereo.
- `ffmpeg`: the recipe is a pure function of the files and lengths, with both cards, the fades and
  the cut length in its arguments; a run on fixtures gives `pitch.mp4` (1920×1080, 20–30 s, an audio
  track), `pitch-square.mp4` (1080×1080) and `pitch.gif` (≤ 8 s, 640 px wide).
- The skill's text forbids any save, delete or change on production, keeps the walk-through script
  beside the run, and writes words only from the spec and release note; `kit/test/plugin.test.mjs`
  and the help entry list `/omni:pitch`.
