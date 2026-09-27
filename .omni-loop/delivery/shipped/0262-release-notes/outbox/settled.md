# Settled outbox items — PRD 262

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-example-notes-invented-product -->

## s1-01-example-notes-invented-product — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-example-notes-invented-product
prd: 262
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The playbook page on releasing shows three example release notes. Should they describe an invented product, or this project's own releases?

## The decision, in plain words

They describe an invented product with reports, invoices and search, because every repository that runs the loop reads this page, not only ours.

## The intro, for fun

Every style guide needs a few examples, and someone has to decide whose story they tell.

## The punchline, for fun

The invented product never ships late, which makes it a very patient example.

## The options, in plain words

A. Examples about an invented product, so any repository reads them as neutral: the option built.
B. Three of this project's own initial release lines, the voice it actually ships.
C. No examples at all, only the rules.

## What I had to decide

What the three example notes in the kit default of the `releasing` form's `notes` slot describe. The spec asks for "the rules above with three example notes" and does not say which product they are about.

## What I did meanwhile

Three notes about an invented product: a public link to a report, invoices in the customer's language, and search as you type. Each parses and passes `omni check releases` (`kit/lib/playbook/releasing.test.mjs`).

## What it costs to change later

One template section and its test: swap the three fenced examples, rebuild the bundle with `pnpm kit:build`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the reviewer would rather the kit default carry this repository's own voice (three of the initial release's lines), which every other repository running the loop would then read as its playbook's example.

```

<!-- /omni-outbox-settled: s1-01-example-notes-invented-product -->

<!-- omni-outbox-settled: s1-02-prd-number-in-title-any-case -->

## s1-02-prd-number-in-title-any-case — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-prd-number-in-title-any-case
prd: 262
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

A release note's title may not name a PRD number. Should the check also refuse one written in lowercase, or with no space before its digits?

## The decision, in plain words

Yes: the check refuses a PRD number however it is written, since the page already shows the number beside every title.

## The intro, for fun

A rule against numbers in titles soon meets a title that whispers its number in lowercase.

## The punchline, for fun

The check hears whispers too, so the number stays out of the headline.

## The options, in plain words

A. Refuse a PRD number in any case, with or without a space: the option built.
B. Refuse only the capitalised form with a space, exactly as the spec writes it.

## What I had to decide

How strictly rule 4 reads "does not match `PRD <digits>`": the spec writes the form in capitals with a space, and does not say whether `prd 7` or `PRD12` count.

## What I did meanwhile

The title rule matches `PRD` in any case, then optional whitespace, then digits, at a word boundary (`/\bPRD\s*\d+/i` in `kit/lib/releases/note.mjs`). Tests pin `PRD 12`, `prd 7` and `PRD12` as refused and `PRDs` as fine.

## What it costs to change later

One regular expression and its test lines; no stored data. A note that passes today still passes under the narrower reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a product name could legitimately read as PRD followed by a number in a title; none is known here.

```

<!-- /omni-outbox-settled: s1-02-prd-number-in-title-any-case -->

<!-- omni-outbox-settled: s2-01-note-step-checks-outside-ground -->

## s2-01-note-step-checks-outside-ground — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-note-step-checks-outside-ground
prd: 262
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The checks that prove the two shipping skills write the release note live in the plugin's test file, which is outside the ground this slice was given. Should the slice add them there anyway?

## The decision, in plain words

Yes. The checks were added to the plugin's test file: no other slice of this wave touches it, and without them nothing would notice a later edit dropping the note step or moving it after the ship.

## The intro, for fun

The test file sat just past the fence, and the slice had a note to prove.

## The punchline, for fun

It proved it over the fence, and wrote down that it did.

## The options, in plain words

A. Add the checks to the plugin's test file, outside the slice's ground: the option built.
B. Keep to the ground: no new check, only the guards that already run on every skill.
C. Keep the checks, and widen the plan so the slice's ground names that test file.

## What I had to decide

Add the checks for the new release-note steps in `kit/test/plugin.test.mjs`, outside the slice's territory (`kit/plugin/skills/yolo/`, `kit/plugin/skills/yolo-fix/`, their porting notes and `.omni-loop/config.yml`), or keep to the territory and rely only on the guards that already run on every skill. The plan asks only that this test file pass; acceptance criterion 10 asks that the two skills write and commit the note before `omni ship`, and says each criterion becomes an ordinary test or a manual step.

## What I did meanwhile

One new block at the end of `kit/test/plugin.test.mjs`, `the release note in the skills that ship`: `/omni:yolo` step 5 names the switch, `omni kb show releasing`, `omni check releases` and the `docs(release)` commit in that order, before `omni ship` and `gh pr ready`, and its red gate names none of them; the resume pointer lands on the item that marks the PR ready; `/omni:yolo-fix` step 7 does the same and rewrites the note; neither skill restates the voice's limits; and this repository's shim prints `releaseNotes.enabled` as `true`. Nothing else outside the ground changed. PRD 216's slice s5 did the same (its item s5-01).

## What it costs to change later

Deleting one block of tests at the end of the file. Nothing depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan only asks that this test file stay green; whether leaving it out of the slice's ground was deliberate is unknown.

```

<!-- /omni-outbox-settled: s2-01-note-step-checks-outside-ground -->

<!-- omni-outbox-settled: s2-02-existing-note-kept-at-ship -->

## s2-02-existing-note-kept-at-ship — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-existing-note-kept-at-ship
prd: 262
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When the loop reaches the moment to ship and a release note is already there, perhaps edited by the reviewer, should it keep that note or write a fresh one from what was built?

## The decision, in plain words

It keeps the note already there and only fixes what the check refuses, so a person's edits are never overwritten. The rework path is the one place that rewrites a note, when a rework changed what the feature does.

## The intro, for fun

Somebody already wrote the headline, and the loop arrives with its own pen.

## The punchline, for fun

The loop puts its pen away and only fixes the spelling the check points at.

## The options, in plain words

A. Keep a note already there, and fix only what the check refuses: the option built.
B. Always write the note afresh from the spec and the built branch, overwriting any note already there.
C. Keep a note a person edited, but rewrite one the loop wrote in an earlier run.

## What I had to decide

What `/omni:yolo` step 5 does when the PRD's folder already holds `release.md` before `omni ship`: a person wrote or edited it on the feature branch, or an earlier run committed it and then stopped before the ship. The spec says yolo writes the note from the spec and the built branch, and that `/omni:yolo-fix` rewrites an existing note when a rework changed what the PRD does; it does not say what yolo does with one already there.

## What I did meanwhile

`/omni:yolo` step 5, item 1: none there, it writes one; one there, it keeps its words and changes only what `omni check releases` refuses, and a kept note that did not change needs no commit. `/omni:yolo-fix` step 7 adds the rewrite when a merged rework changed what the PRD does.

## What it costs to change later

One sub-bullet of `/omni:yolo` step 5 and a line of its porting note. No code, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reviewer ever edits the note on the branch before the loop ships, rather than after, is not known yet: the note is new.

```

<!-- /omni-outbox-settled: s2-02-existing-note-kept-at-ship -->

<!-- omni-outbox-settled: s4-01-broken-note-stops-the-sync -->

## s4-01-broken-note-stops-the-sync — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-broken-note-stops-the-sync
prd: 262
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When a release note that breaks the writing rules reaches the main branch, what should the publishing step do with that release and with the others?

## The decision, in plain words

It publishes nothing at all until the note is fixed, lists every broken rule, and fails loudly, so no release is ever numbered out of order.

## The intro, for fun

One sloppy note slips past two guards and lands on the main branch. Somebody has to decide how loud to be.

## The punchline, for fun

The whole release train waits at the platform until one note learns to spell.

## The options, in plain words

A. Publish nothing until the broken note is fixed, list every broken rule and fail the run: the option built.
B. Publish the others, leave that PRD out and fail the run: it would get its number later than PRDs that reached main after it.
C. Publish that PRD under its spec title with no description, as if it had no note, and fail the run: a note pinned to the initial release would then take a later number, for good.
D. Publish the broken note as written and only warn in the log.

## What I had to decide

What the sync does when a shipped PRD's `release.md` fails the rules `omni check releases` enforces (or a shipped folder has no `spec.md`, or a note-less PRD's spec cannot be parsed). The spec settles a PRD with no note (rule 5: its spec title, an empty description) but not a note that is there and broken. The ship guard and the feature PR's review should stop it before main, yet a hand edit or a later rule change can still put one there.

## What I did meanwhile

`apps/galaxy/src/releases/sync-shipped.ts` refuses such a folder, naming the file and each rule in the kit's words, and `sync-run.ts` then writes nothing (no insert, no text refresh), prints the refusals and exits 1, so the releases workflow fails. Once a pull request fixes the note, the next run numbers every PRD waiting since in main's order, so a rebuild still gives the same rows (`sync-run.test.ts`, `sync-shipped.test.ts`).

## What it costs to change later

A few lines in `sync-shipped.ts` and `sync-run.ts` and their tests. Nothing stored changes: numbers are only stamped by a successful run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether one broken note may hold back every other release, or how long such a block may last before someone notices the red workflow run.

```

<!-- /omni-outbox-settled: s4-01-broken-note-stops-the-sync -->

<!-- omni-outbox-settled: s4-02-service-role-cannot-renumber -->

## s4-02-service-role-cannot-renumber — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-service-role-cannot-renumber
prd: 262
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The publishing step is the only writer of the public release list. Should the database let it change a release's number or date, or delete a release, or only add releases and fix their wording?

## The decision, in plain words

It may only add releases and fix their title and description. A version or a date, once published, cannot be changed by it, and removing a release stays a person's job in the database console.

## The intro, for fun

A version number is a promise to the outside world, so the question is who gets a pen that can rewrite it.

## The punchline, for fun

The robot may fix typos, but the numbers are carved in stone and it did not bring a chisel.

## The options, in plain words

A. The service role adds releases and retitles them only; a person renumbers, redates or removes one in the database console: the option built.
B. The service role may also update every column and delete rows, and only the sync's own code keeps its promises.

## What I had to decide

Which writes the migration grants the service role on `public.releases`. The spec says nobody but the service role writes, the sync keeps a row's `release` and `released_at` forever and never deletes a row, and removing a release is a person's decision made in the database; it does not say whether the database itself should hold the service role to that.

## What I did meanwhile

`supabase/migrations/20260929090000_releases.sql` grants the service role `select` and `insert`, and `update` on `title` and `description` only, with no `delete`. `supabase/checks/releases.sql` proves it may add and retitle, and is refused a renumber, a redate and a delete. The sync (`sync-table.ts`) inserts new rows and updates only those two columns, so it needs nothing more.

## What it costs to change later

One follow-up migration granting more (`update` on every column, or `delete`) and the matching lines of the check. No row changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether anyone expects another tool running as the service role, rather than a person in the database console, to correct a wrong version or date or remove a release.

```

<!-- /omni-outbox-settled: s4-02-service-role-cannot-renumber -->

<!-- omni-outbox-settled: s5-01-env-example-names-the-sync -->

## s5-01-env-example-names-the-sync — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-env-example-names-the-sync
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

The app's example settings file says the database's secret key serves only the game's commands, yet the new publishing step uses that key too, plus a setting the file does not list. Should the file say so?

## The decision, in plain words

The file was left as it is, since no part of this work was given it. The app's guide now names both settings the publishing step reads, and where each comes from.

## The intro, for fun

A settings file swears the secret key has exactly one job, and a second job just walked in.

## The punchline, for fun

The guide now tells the whole story; the file catches up once someone may touch it.

## The options, in plain words

A. Leave the file as it is, and describe both settings in the app's guide only: the option built.
B. Change the file too: say the secret key also serves the publishing step, and add the project address it needs.

## What I had to decide

Whether `apps/galaxy/.env.example` should change. It says `SUPABASE_SERVICE_ROLE_KEY` is "Only for the `pnpm game:*` commands" and has no `SUPABASE_URL` line, while `pnpm releases:sync` (s4) reads both, from `apps/galaxy/.env.local` too, as the `game:*` scripts do. The file is outside every slice's territory in the plan, so s5 does not edit it. In my judgment it should change: someone copying it for a local sync would not learn that the sync needs `SUPABASE_URL` (the `NEXT_PUBLIC_` URL is not read), and the comment on the key is no longer true.

## What I did meanwhile

`apps/galaxy/README.md` (s5's ground) documents the sync's two variables in its Release notes section and under With a local Supabase (`SUPABASE_URL=http://127.0.0.1:54321 pnpm releases:sync`), and its secrets table names `releases.yml` beside `game.yml` for `SUPABASE_SERVICE_ROLE_KEY`. `.env.example` is unchanged.

## What it costs to change later

Option B is two comment lines and one empty `SUPABASE_URL=` line in `apps/galaxy/.env.example`, in a follow-up. No code, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan left the example settings file out of every slice on purpose.

```

<!-- /omni-outbox-settled: s5-01-env-example-names-the-sync -->

<!-- omni-outbox-settled: s5-02-canonical-address-production-host -->

## s5-02-canonical-address-production-host — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-canonical-address-production-host
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

Search engines and link previews are told one official web address for the release notes page. Which address should that be?

## The decision, in plain words

The app's current public address, written once in the page, so every copy of the page, preview copies included, sends search engines to the same place.

## The intro, for fun

Every page wants one true address, even when a dozen preview copies serve it.

## The punchline, for fun

The page now points home, and moving home later is a one-line change.

## The options, in plain words

A. The app's current public address, written once in the page: the option built.
B. The address the hosting service reports as the production one, read when the page is built, the written address as a fallback.
C. No official address: search engines pick whichever copy they find.

## What I had to decide

The spec asks for a canonical address and Open Graph tags on `/releases` and does not name the host. Next needs an absolute URL for both, and the app sets no `metadataBase` anywhere.

## What I did meanwhile

`SITE = 'https://vertuo-omni-loop-galaxy.vercel.app'` in `apps/galaxy/src/releases/page/address.ts`: the default of `signature.home` and this repository's `ask.url`. The canonical and `og:url` are `<SITE>/releases` (`apps/galaxy/src/releases/page/render.test.ts`), checked in the dev server's HTML.

## What it costs to change later

One constant and its test line; a custom domain later changes the constant. Search engines re-read the canonical at their next crawl. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a custom domain is planned for the app, which would leave the written address pointing at the old one.

```

<!-- /omni-outbox-settled: s5-02-canonical-address-production-host -->

<!-- omni-outbox-settled: s5-03-empty-table-says-no-release-yet -->

## s5-03-empty-table-says-no-release-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-empty-table-says-no-release-yet
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

Right after the page goes live, and before the first publishing run, the list of releases is empty. What should a visitor read then?

## The decision, in plain words

A short line saying no release is published yet, under the page's heading. It differs from the message shown when the page cannot be read at all.

## The intro, for fun

Opening night: the stage is set, and the cast has not arrived yet.

## The punchline, for fun

The sign on the door says the show starts soon, not that the theatre burned down.

## The options, in plain words

A. A line of its own, saying no release is published yet: the option built.
B. The same line as when the page cannot be read, saying release notes are unavailable right now.
C. Only the heading and its line, with nothing under them.

## What I had to decide

What `/releases` shows when `public.releases` answers with no row: the migration has run and the sync has not. The spec names the unavailable message for closed mode and a failed read, and says nothing of an empty table.

## What I did meanwhile

`RELEASES.empty`, *No release is published yet.*, in `apps/galaxy/src/releases/words.ts`, shown by `ReleasesPage` when there is no week (`apps/galaxy/src/releases/page/render.test.ts`). An empty read is a good read: it replaces an older render like any other.

## What it costs to change later

One word constant and one branch of the page. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long the table stays empty in production: the sync follows each successful migration run on main, so minutes once the repository variables are set.

```

<!-- /omni-outbox-settled: s5-03-empty-table-says-no-release-yet -->

<!-- omni-outbox-settled: s5-04-demo-sample-invented-releases -->

## s5-04-demo-sample-invented-releases — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-demo-sample-invented-releases
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

When the app runs without its database, on a developer's machine, the release notes page shows a sample. What should that sample hold?

## The decision, in plain words

The real initial release, word for word, then six invented releases over the following weeks, so the sample shows how older weeks fold away.

## The intro, for fun

A sample page needs a past, and this project only has one week of it so far.

## The punchline, for fun

So the sample borrows a few weeks from the future, and promises nothing about them.

## The options, in plain words

A. The real initial release, then invented releases over five weeks: the option built.
B. Only the real initial release: nothing invented, but no folded week to see.
C. The real initial release, then entries that read plainly as placeholders.

## What I had to decide

The spec asks for a built-in demo sample, and for screenshots of `/releases` from it; it does not say what the sample holds. Showing a folded week takes more than four weeks of releases, and only one week exists.

## What I did meanwhile

`apps/galaxy/src/releases/demo.ts`: the 21 pinned notes, word for word, each dated when its shipped folder reached main (its test holds them to the shipped notes), then releases 0.0.2 to 0.0.7 (PRDs 262, 270, 284, 291, 305 and 318) from 28 September to 20 October 2026, each passing the note rules. 0.0.2 is the before/after page's own example. Only development and `OMNI_LOOP_DEMO=1` builds show it.

## What it costs to change later

The sample rows in one file and its test. Nothing in production reads them; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The invented releases carry PRD numbers that real PRDs may take later; in development they could be read as real.

```

<!-- /omni-outbox-settled: s5-04-demo-sample-invented-releases -->

<!-- omni-outbox-settled: s5-05-version-links-to-its-release -->

## s5-05-version-links-to-its-release — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-05-version-links-to-its-release
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

Each release on the page has its own web address, so one release can be shared. Should its version number be a link to that address?

## The decision, in plain words

Yes: a click on a version puts that release's own address in the browser, ready to copy. The number of the product plan beside it stays plain text.

## The intro, for fun

Every release got its own address, and nobody told the visitor where to find it.

## The punchline, for fun

Now each version points at itself, the most modest link on the web.

## The options, in plain words

A. The version links to its own release, the address ready to copy: the option built.
B. No link: the address works, but a visitor has to know to type it.

## What I had to decide

The spec gives each release an anchor, its version (`/releases#0.0.3`), so one release can be shared, and says `PRD <n>` is never a link; it does not say how a visitor finds the anchor. The before/after page draws the version as a badge.

## What I did meanwhile

In `apps/galaxy/src/releases/page/ReleasesPage.tsx` the version badge is `<a href="#0.0.3">`, titled *Link to this release*, and a release opened by its anchor shows its badge filled (`:target` in `releases.css`). The PRD stays plain text, and a release holds no other link (`render.test.ts`).

## What it costs to change later

One element and two CSS rules. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether visitors expect a version badge to be clickable.

```

<!-- /omni-outbox-settled: s5-05-version-links-to-its-release -->
