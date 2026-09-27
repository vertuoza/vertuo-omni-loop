# Plan: Release notes

PRD #262, spec beside this plan (`spec.md`). The feature branch `feat/release-notes` merges into
`main` through the feature PR, whose body says `Closes #262`. Each slice is a sub-PR from
`feat/release-notes--<slice>` into the feature branch, whose body says `Part of #262`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The note has a shape the kit checks, and ship refuses without one. Covers: the `release.md` parser; `omni check releases`, also run by `omni check all`; the `releaseNotes: { enabled: false }` config section; the ship guard in `planShip`; the optional `notes` slot of the `releasing` form with its kit default (the voice rules and three example notes) and its porting note; the kit README's lines; the rebuilt bundle | `kit/lib/releases/` `kit/lib/config` `kit/lib/delivery/ship` `kit/lib/playbook/` `kit/bin/commands/check.mjs` `kit/bin/check` `kit/templates/playbook/releasing.md` `kit/porting/templates--releasing.md` `kit/README.md` `kit/dist/omni.mjs` | — | 1 |
| s2 | The loop writes the note when it ships. Covers: the release-note step in `/omni:yolo` step 5 and `/omni:yolo-fix` step 7 (write from the spec and the built branch, `omni check releases` until green, commit `docs(release): PRD <n> release note`, then ship), their porting notes, and this repository's `releaseNotes: { enabled: true }` | `kit/plugin/skills/yolo/` `kit/plugin/skills/yolo-fix/` `kit/porting/plugin--yolo.md` `kit/porting/plugin--yolo-fix.md` `.omni-loop/config.yml` | s1 | 2 |
| s3 | The initial release is written. Covers: one `release.md` pinned `version: 0.0.1` in every shipped PRD folder (the spec's 21 lines verbatim, and a note in the same voice for any PRD shipped since), and the delivery README's line for `release.md` | `.omni-loop/delivery/shipped/` `.omni-loop/delivery/README.md` | s1 | 2 |
| s4 | A shipped PRD gets its version, once. Covers: the `public.releases` migration (columns, the partial unique index, row-level security, the public select, explicit grants); `supabase/checks/releases.sql` and its step in the `supabase` workflow; the sync's pure rules and its git reading in `apps/galaxy/src/releases/`; `apps/galaxy/scripts/releases-sync.mjs`; the root `releases:sync` script; `.github/workflows/releases.yml` | `supabase/migrations/20260929090000_releases` `supabase/checks/releases.sql` `.github/workflows/supabase.yml` `.github/workflows/releases.yml` `apps/galaxy/src/releases/row` `apps/galaxy/src/releases/sync` `apps/galaxy/src/releases/git` `apps/galaxy/scripts/releases-sync.mjs` `package.json` | s1 | 2 |
| s5 | Anyone reads the releases, week by week. Covers: `/releases` with its layout, metadata and failure state; the week grouping in Brussels time; the page's words, the initial release's headline and intro; the demo sample; the read of `public.releases` with the publishable key and no session; the fifth `/app` card; the galaxy README (the page, the sync, `releases.yml` in the secrets table); the manual acceptance with screenshots | `apps/galaxy/app/releases/` `apps/galaxy/src/releases/page/` `apps/galaxy/src/releases/weeks` `apps/galaxy/src/releases/words` `apps/galaxy/src/releases/demo` `apps/galaxy/src/releases/store` `apps/galaxy/src/switch/` `apps/galaxy/README.md` | s4 | 3 |

**Shared ground.** No prefix is declared by more than one slice. Where slices meet anyway, they meet
across waves:

- `kit/dist/omni.mjs` is s1's alone. s2 changes only skills and this repository's config, which the
  bundle does not carry, so it rebuilds nothing. Rebuild the bundle with `pnpm kit:build` from the
  merged source, never by hand (`kit/test/dist.test.mjs`).
- `apps/galaxy/src/releases/` is split by file prefix: s4 owns `row`, `sync` and `git`, and s5 owns
  `page/`, `weeks`, `words`, `demo` and `store`. s5 reads s4's row schema, one wave later.
- The root `package.json` is s4's alone: one script, `releases:sync`, and no dependency, so
  `pnpm-lock.yaml` does not change.
- `.github/workflows/supabase.yml` is s4's alone: it adds the `releases.sql` step beside the others.
- `apps/galaxy/README.md` is s5's alone, and it documents the sync as well as the page, so s4 writes
  no README.
- Wave 2 runs s2 (skills and config), s3 (shipped folders) and s4 (database, sync and workflow)
  together: their territories do not meet.

The ordering has reasons behind it:
- s2, s3 and s4 follow s1: the skills name `omni check releases` (the plugin test refuses a command
  the CLI does not have), s3's notes must pass that check, and the sync reads notes through s1's
  parser.
- s5 follows s4: the page reads the row schema and the table s4 creates. It ends the PRD, so it
  carries the manual acceptance.

## Per slice: done when

**s1: the note has a shape the kit checks, and ship refuses without one**
- The parser reads `prd`, `title`, the optional `version` and the one-paragraph description from
  `release.md`, and refuses any other front-matter field by name.
- `omni check releases` passes a repository with no note, and passes a good note in `inbox/` and in
  `shipped/`. It fails, naming the file and the rule, on each of:
  - a missing or extra front-matter field;
  - a `prd` that is not the folder's;
  - `version` other than `0.0.1`;
  - a title over 60 characters, on two lines, ending with `.`, or holding `PRD 12`;
  - a description over 280 characters, or with a blank line, a heading or a list item;
  - a URL, a `#12`, a backtick, or a `.omni-loop/` path in either.
- `omni check all` runs it, through `main()` on a `makeRepo()` fixture.
- `releaseNotes.enabled` defaults to `false` and accepts `true`. A non-boolean is refused with the
  key named (`kit/lib/config.test.mjs`).
- With the switch on, `planShip` refuses a folder with no `release.md` (`no release note: <path>`)
  and a note that fails the check (`release note: <rule>`). With a good note, the move carries it to
  `shipped/`. With the switch off, `planShip`'s result is unchanged from today on the existing
  fixtures.
- The `releasing` template holds the optional `notes` slot. `omni kb show releasing` prints its kit
  default when the repository leaves it blank, and `omni check kb` stays green on this repository.
- `kit/test/no-literals.test.mjs`, `kit/test/dist.test.mjs`, `kit/test/bundle-playbook.test.mjs`
  and `pnpm test` pass.

**s2: the loop writes the note when it ships**
- `/omni:yolo` step 5, gate green: when `omni config releaseNotes.enabled` is true, before
  `omni ship`, it writes `<folder>/release.md` from the spec and the feature branch's diff,
  following `omni kb show releasing`. It runs `omni check releases` until green, and commits
  `docs(release): PRD <n> release note` with the trailers. With the switch off, the step is skipped.
- `/omni:yolo-fix` step 7 does the same. It rewrites an existing note when the rework changed what
  the PRD does.
- Each skill's porting note records the change. `kit/test/plugin.test.mjs` passes: every `omni`
  command the skills name exists.
- `.omni-loop/config.yml` sets `releaseNotes: { enabled: true }` with a comment naming PRD 262.
  `omni config` prints it.

**s3: the initial release is written**
- Every folder under `shipped/` holds a `release.md` pinned `version: 0.0.1`. For the 21 PRDs in the
  spec's table, title and description are the table's words exactly. Any PRD shipped since the spec
  gets a note in the same voice.
- `omni check releases` passes on all of them.
- The delivery README lists `release.md` among a shipped folder's files, and says the sync stamps
  its version.

**s4: a shipped PRD gets its version, once**
- The migration creates `public.releases` as the spec's table:
  - `release` unique above 1;
  - row-level security on, one select policy for `anon` and `authenticated`;
  - grants revoked, then granted, as the other migrations do.
- `supabase/checks/releases.sql`, run by the `supabase` workflow's check job, proves:
  - `anon` and `authenticated` can select;
  - neither can insert, update or delete;
  - a second PRD on the same release above 1 is refused.
- The sync's pure rules, on in-memory fixtures:
  - A pinned note gets release 1.
  - Unpinned PRDs are numbered from 2 in first-on-main order, the lower PRD number first on a tie.
  - An existing row keeps its number and date and takes the new title and description.
  - A PRD with no note takes its spec's title and an empty description.
  - No row is deleted.
  - Rebuilding from an empty table gives the same rows as running in steps.
- The git reading, on a throwaway repository built in the test:
  - The first commit that adds `shipped/<folder>/spec.md` is found, the folder having been renamed
    from `inbox/`.
  - Its committer date is returned.
- `pnpm releases:sync` reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and names the missing
  one when either is unset. It prints each PRD it inserted or updated, and exits non-zero when
  Supabase refuses.
- `releases.yml` holds:
  - its three triggers: a push to `main` under `.omni-loop/delivery/shipped/**` or the workflow
    itself, a successful `supabase` run on `main`, and a dispatch;
  - `fetch-depth: 0`;
  - `group: releases` with `cancel-in-progress: false`;
  - the `SUPABASE_PROJECT_ID` guard, and the credentials of `game.yml`.
- No test calls Supabase or GitHub.

**s5: anyone reads the releases, week by week**
- Weeks, as pure functions:
  - A week starts on Monday in Europe/Brussels. A release at 23:30 UTC on a Sunday falls in the
    next week.
  - Weeks run newest first, with releases newest first inside a week.
  - Release 1 is dated by its latest row, and its lines run in PRD order.
  - The four newest weeks are open, and older ones are folded with their release and PRD counts.
- The page, rendered with `renderToStaticMarkup` from the demo sample:
  - The app bar holds `OMNI LOOP` · Releases, the theme switch and Game mode.
  - The heading and its line are there, with `Week of <date>` headings.
  - Each release shows its version, its day and `PRD <n>` as plain text.
  - Release 0.0.1 shows *Initial release*, the headline, the intro and its lines.
  - Older weeks are `<details>` elements.
  - Each release has its anchor.
- The page's metadata carries a title, description, canonical address and Open Graph tags, and no
  `noindex`. The page imports no sign-in helper, reads no cookie, and holds no `github.com` link.
- Closed mode shows *Release notes are unavailable right now.* A failed read renders the same line
  with no error detail. The page is regenerated at most every 5 minutes, and a failed read never
  fails `pnpm galaxy:build`.
- `SECTIONS` holds five cards, the fifth **Release notes**, `/releases`, *What Omni Loop shipped,
  week by week*, and its page exists on disk.
- The galaxy README describes `/releases`, the sync and `releases.yml`. Its secrets table lists
  `releases.yml` beside `game.yml` for `SUPABASE_SERVICE_ROLE_KEY`.
- By hand, in the sub-PR: screenshots of `/releases` from the demo sample at 393×700 and 1440×900,
  in light and dark, and of `/app` with its fifth card.
