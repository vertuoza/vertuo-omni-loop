# Settled outbox items — PRD 324

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-context-bar-cells-rounded-down -->

## s1-01-context-bar-cells-rounded-down — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-context-bar-cells-rounded-down
prd: 324
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The example line in the spec draws six filled cells for 58 %, while its rule, one filled cell for each whole 10 %, gives five. Which one should the context bar follow?

## The decision, in plain words

The bar follows the rule: one filled cell for each whole 10 %, so 58 % fills five cells out of ten. The example line is read as drawn by hand.

## The intro, for fun

The spec drew the bar's rule with a ruler, then sketched its example freehand.

## The punchline, for fun

Fifty-eight now fills five cells, exactly as the rule counts them.

## The options, in plain words

A. Round down, one filled cell for each whole 10 %, as the rule and the plan's list say: 58 % fills five cells. The option built.
B. Round to the nearest cell, as the example draws it: 58 % fills six cells, but then 49 % fills five and 79 % fills eight, against the plan's list.

## What I had to decide

Whether the context bar fills one cell per whole 10 % (the spec's rule, and the plan's list of cells at 0, 49, 50, 79, 80, 100 and 130 %), or rounds to the nearest cell, as the spec's and the plan's example line `██████░░░░ 58%` draws it.

## What I did meanwhile

The bar rounds down: 0, 49, 50, 79, 80, 100 and 130 % fill 0, 4, 5, 7, 8, 10 and 10 cells, as the plan's done-when lists them, and 58.9 % fills five. The done-when's expected line is asserted with five cells, `█████░░░░░ 58%`, not the six its example draws.

## What it costs to change later

One expression in `kit/lib/statusline/render.mjs` and the expected cells in its tests and in `kit/bin/statusline.test.mjs`. No stored data, and no other slice depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example line and its rule disagree, and the plan's done-when repeats the example line while also listing the cells the rule gives; nothing says which one wins.

```

<!-- /omni-outbox-settled: s1-01-context-bar-cells-rounded-down -->

<!-- omni-outbox-settled: s1-02-five-hour-reset-time-read -->

## s1-02-five-hour-reset-time-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-five-hour-reset-time-read
prd: 324
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Claude Code tells the status line when the 5-hour usage resets, but the spec says neither in which form that moment comes nor how to count a minute that has only started. How should the line read it?

## The decision, in plain words

A number is read as seconds since 1970, and a text as a date. The time left counts a started minute as a whole one, so the last minute before the reset reads 1m, never 0m.

## The intro, for fun

The clock says when the window reopens, but not which way it tells the time.

## The punchline, for fun

Both ways are understood, and the countdown never reaches zero before the reset does.

## The options, in plain words

A. Seconds since 1970 or a date, minutes rounded up so the last minute reads 1m: the option built.
B. Seconds since 1970 or a date, minutes rounded down, so the last minute before the reset reads 0m.
C. Seconds since 1970 only: a moment sent as a date leaves the usage out of the line.

## What I had to decide

Whether `rate_limits.five_hour.resets_at` is read as Unix seconds, milliseconds or an ISO date, and whether the time to it rounds its minutes up or down.

## What I did meanwhile

A number is read as Unix seconds and a text as a date; anything else leaves the usage part out. The time left is counted in whole minutes rounded up: 30 seconds read `1m`, 44 minutes and a second read `45m`, 59 minutes and 30 seconds read `1h00`. The spec's own cases, `45m` and `1h05`, read the same either way.

## What it costs to change later

One function in `kit/lib/statusline/input.mjs`, one in `kit/lib/statusline/render.mjs`, and their tests. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the field but not its form: Claude Code's documentation, which is not in this repository, is the authority, and nothing here was checked against a live payload.
- (author) The spec gives `45m` and `1h05` but not how a part of a minute is counted.

```

<!-- /omni-outbox-settled: s1-02-five-hour-reset-time-read -->

<!-- omni-outbox-settled: s2-01-commit-line-names-settings -->

## s2-01-commit-line-names-settings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-commit-line-names-settings
prd: 324
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Setting up the loop now also adds the status line to the shared Claude Code settings. Should the closing message ask the person to commit that settings file too?

## The decision, in plain words

Yes. The closing message names both the loop's folder and the settings file when both were written, the settings file alone when only it was, and still says nothing is new when neither was.

## The intro, for fun

Setup now touches a second file, and its goodbye note only knew how to mention one.

## The punchline, for fun

The note now lists both, so nothing is left behind uncommitted.

## The options, in plain words

A. Name every place this run wrote, the settings file included, so a rerun that only adds the status line asks for a commit. The option built.
B. Keep the commit line as it was: it names only the loop's folder, and a rerun that only adds the status line says there is nothing new to commit.

## What I had to decide

What `omni init`'s closing steps ask a person to commit once init can write `.claude/settings.json` too. The spec gives the status line paragraph and the new removal line, but says nothing of the line above the steps, `Commit .omni-loop/ and merge it into <branch>, then, by hand:`, which named only the loop's folder.

## What I did meanwhile

The commit line names what this run wrote: `Commit .omni-loop/ and .claude/settings.json, and merge them into <branch>, then, by hand:` when both; `Commit .claude/settings.json and merge it into <branch>, then, by hand:` when only the key was written (a repository that already had the loop runs init again); `Commit .omni-loop/ and merge it into <branch>, then, by hand:` when only the loop's folder was; `Nothing new to commit. By hand, unless already done:` when neither. With `--force` the kit's line is rewritten, so it counts as written, as the config and the bin do.

## What it costs to change later

One expression in `kit/lib/init/steps.mjs` and the expected lines in `kit/bin/init.test.mjs`. No stored data, and no other slice reads init's output.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists what the closing steps gain (the status line paragraph, the new removal line) but not whether the commit line above the steps names the settings file; before this PRD it named only the loop's folder.

```

<!-- /omni-outbox-settled: s2-01-commit-line-names-settings -->

<!-- omni-outbox-settled: s2-02-settings-not-an-object-left-alone -->

## s2-02-settings-not-an-object-left-alone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-settings-not-an-object-left-alone
prd: 324
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

If the shared Claude Code settings file holds valid JSON that is not a set of settings, such as a bare list or a single value, or cannot be read as a file at all, what should setup do?

## The decision, in plain words

Treat it like a file that is not valid JSON: leave it exactly as it is, add no status line, say that it skipped the file, and finish setup as usual.

## The intro, for fun

The settings file was perfectly valid, and perfectly not settings.

## The punchline, for fun

Setup leaves it alone and moves on, as it does with any file it cannot use.

## The options, in plain words

A. Leave the file alone and print the line for a file that is not valid JSON. The option built.
B. Leave the file alone and print a line of its own, saying the file holds no settings.
C. Stop setup with an error, so a person repairs the file first.

## What I had to decide

What `omni init` does when `.claude/settings.json` parses as JSON but is not an object (`[]`, `null`, a string, a number), or when that path cannot be read as a file (a folder, no permission). The spec names only a file that is not valid JSON.

## What I did meanwhile

Both are left byte-identical and print the spec's line for a file that is not valid JSON, `skipped .claude/settings.json: not valid JSON, no status line added`, and init exits 0. A missing file is still created with its folder.

## What it costs to change later

One branch in `kit/lib/init/settings.mjs` and two cases in `kit/lib/init/settings.test.mjs`; a line of its own would be one more entry in `kit/lib/init/steps.mjs`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives four printed lines, and none for valid JSON that holds no settings object, or for a settings path that is not a readable file.

```

<!-- /omni-outbox-settled: s2-02-settings-not-an-object-left-alone -->

<!-- omni-outbox-settled: s2-03-status-line-steps-only-when-on -->

## s2-03-status-line-steps-only-when-on — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-status-line-steps-only-when-on
prd: 324
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When setup finds someone else's status line, or a settings file it cannot read, should its closing message still say the status line is on for everyone, and tell people to delete the status line setting to remove the loop?

## The decision, in plain words

No: those two sentences appear only while the loop's own status line is in place. Otherwise the message keeps the old removal sentence, which names only the loop's folder, so nobody is told to delete a line the loop did not add.

## The intro, for fun

Setup found a status line it never wrote, and very nearly took the credit for it.

## The punchline, for fun

Now it only talks about the lines it actually wrote.

## The options, in plain words

A. Say both only while the loop's own status line is in place, and otherwise keep the old removal sentence. The option built.
B. Always print both sentences as the spec words them, even when the line in the file is someone else's or the file could not be read.
C. When the line is someone else's, also say how to switch the loop's own line on instead, and keep the old removal sentence.

## What I had to decide

What `omni init`'s closing steps say when it leaves `.claude/settings.json` without the kit's line: someone else's `statusLine`, or a file that is not valid JSON. The spec gives the status line paragraph and the new removal line without saying whether they depend on what init did with the file.

## What I did meanwhile

The paragraph (on for everyone who opens Claude Code in the repository; a person keeps their own in `.claude/settings.local.json`) and the removal line naming the `statusLine` key print only when the key was written or the kit's own was kept. After `kept    .claude/settings.json  (its statusLine is not the kit's)` or `skipped .claude/settings.json: not valid JSON, no status line added`, the paragraph is left out and the removal line stays the old one: `To remove the loop: delete .omni-loop/ and commit. The labels and the App installation stay.`

## What it costs to change later

One condition in `kit/lib/init/steps.mjs` and two cases in `kit/bin/init.test.mjs`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec words the closing steps for a repository where the kit's line is written or kept; it does not say what they say when init leaves someone else's line, or a file it cannot read, alone.

```

<!-- /omni-outbox-settled: s2-03-status-line-steps-only-when-on -->

<!-- omni-outbox-settled: s3-01-rest-of-home-still-says-one-folder -->

## s3-01-rest-of-home-still-says-one-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-rest-of-home-still-says-one-folder
prd: 324
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The front page now says, where it explains adopting and leaving the loop, that setting it up adds a status line too. Should the two other places on that page that still promise one folder only, and the app guide that sums up that section, change as well?

## The decision, in plain words

Only the section on adopting and leaving changed, as the brief asks. The banner's promise of one folder in and one folder out, the card promising heads of engineering one folder to adopt, and the guide's summary of the section are left as they were.

## The intro, for fun

The page learned a new line in one spot, and still hums the old tune in two others.

## The punchline, for fun

One section sings the new verse, while the chorus waits for a person to pick its words.

## The options, in plain words

A. Leave the banner's promise, the card's proof and the guide's summary as they are: only the section on adopting and leaving names the status line. The option built.
B. Bring the guide's summary of the section in line with the page, and keep the banner's promise and the card's proof, read as the loop's one folder in spirit.
C. Bring the guide's summary in line, and reword the banner's promise and the card's proof too, so nothing on the page promises one folder only.

## What I had to decide

Whether HOME's other one-folder claims change with the "Easy in, easy out" spread: the poster's promise strip `ONE FOLDER IN, ONE FOLDER OUT` (`apps/galaxy/src/home/poster/Poster.tsx`, asserted in `apps/galaxy/src/home/home.test.ts`), the HEAD OF ENGINEERING proof `One folder to adopt; delete it to stop.` (`apps/galaxy/src/home/spreads/ForYou.tsx`), and the HOME section of `apps/galaxy/README.md`, whose item 5 still sums the spread up as "GET OUT: delete `.omni-loop/` and commit". The spec's D3 says the one-folder promise is no longer true and HOME must not say it is; its Scope puts "HOME outside the Easy in, easy out spread" out; and the plan's s3 territory holds only the spread and `.claude/settings.json`.

## What I did meanwhile

Only the spread changed: GET IN's first step and GET OUT's bold line read exactly as the spec's HOME section words them, each path and the `statusLine` key in `<code>`, asserted in `InOut.test.ts`, with `lingo.test.ts` green. The promise strip, the For-you proof and the README's summary line are untouched, and still say one folder.

## What it costs to change later

Copy only: one string in `Poster.tsx` with its assertions in `home.test.ts` (and the README's description of the promise strip), one proof in `ForYou.tsx` with `ForYou.test.ts`, and one line of `apps/galaxy/README.md`. No stored data, and no other slice depends on it. Any rewording must keep `lingo.test.ts` green.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's D3 (HOME must not say the one-folder promise) and its Scope (HOME outside the spread is out) disagree on the promise strip and the For-you proof; nothing says which one wins.
- (author) `apps/galaxy/README.md` is outside s3's territory, so its summary of the spread could not be brought in line in this slice.

```

<!-- /omni-outbox-settled: s3-01-rest-of-home-still-says-one-folder -->
