# Plan: Keep what a fix or a review leaves open

PRD #2739 · spec: `spec.md` beside this plan · feature branch `feat/follow-ups` into `main`
(`Closes #2739`) · sub-PRs from `feat/follow-ups--<slice>` into the feature branch (`Part of #2739`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni follow-up add` writes one file per open point in `<paths.delivery>/follow-ups/`, refuses a duplicate or a bad source, and `omni follow-up list` prints them oldest first | `kit/lib/follow-ups/` `kit/bin/commands/follow-up.ts` `kit/bin/follow-up.test.ts` `kit/bin/commands/index.ts` `kit/lib/help/` `.omni-loop/delivery/README.md` | — | 1 | build |
| s2 | `omni bug` and `omni bug check --product` refuse a `## Still open` point with no follow-up file, and the bug-fix skills write the points | `kit/lib/bug/` `kit/bin/bug.test.ts` `kit/bin/bug-product.test.ts` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` | s1 | 2 | build |
| s3 | `omni care reply --verdict later` posts, resolves and writes the follow-up, and `omni ship` refuses a `later` reply with no file | `kit/lib/care/` `kit/bin/commands/care.ts` `kit/bin/care.test.ts` `kit/lib/delivery/ship` `kit/bin/commands/ship.ts` `kit/lib/policy/outbox-policy.ts` `kit/lib/policy/outbox-policy.test.ts` `kit/plugin/skills/pr-care/` | s1 | 2 | deep |
| s4 | `omni status` shows `follow-ups  N open · oldest <date> → omni follow-up list` when points exist | `kit/lib/status/` `kit/bin/commands/status.ts` `kit/bin/status.test.ts` | s1 | 2 | build |
| s5 | the guide says where open points go and how a person closes one | `docs/guide/loop.md` | s2, s3, s4 | 3 | light |

**Shared ground.** No prefix is declared by two slices. `kit/bin/commands/index.ts` (the command
table) and `kit/lib/help/` are s1's alone: s2 to s4 change existing commands and add no entry. The
generated `kit/dist/` is rebuilt by the wave, never listed.

## Per slice: done when

### s1
- `omni follow-up add --source 'bug #12' --text 'The retry loop never stops.'` writes
  `.omni-loop/delivery/follow-ups/<today>-the-retry-loop-never-stops.md` with `source`, `date` and
  the text, and prints its path; run again, it exits 1 naming that file.
- An empty text, a text over 300 characters, or a source that is none of `bug #<n>`, `<key>-B<n>`,
  `PRD #<n> · <url>` exits 2 with one line.
- `omni follow-up list` prints date, source and first line oldest first, `--json` the same as JSON,
  and `none` when the folder is empty or missing.
- No network call: the test injects `exec` and asserts nothing was called.
- `omni help follow-up` describes both verbs; the delivery README describes the folder.

### s2
- `omni bug <n>` on a record whose `## Still open` holds a bullet with no file of source `bug #<n>`
  and the same text prints `not ok` and the line naming the bullet and the command to run (the test
  that would have caught the kit-gaps review's item 1 bug records); with the file, `ok`; no section
  or `none`, `ok`.
- `omni bug check --product <key> <file>` does the same for `<key>-B<n>`; with `--new`, it skips
  the check and says so in one line.
- `/omni:bug-fix` and `/omni:mega-bug-fix` write each `Follow-up:` line as a `## Still open` bullet
  and run `omni follow-up add` on the fix branch before the PR leaves draft.

### s3
- `omni care reply --verdict later --prd 7 --thread <id> --file <f>` posts a reply ending with
  `<!-- omni-care: later -->`, resolves the thread and writes the follow-up of source
  `PRD #7 · <thread url>`; `--point <text>` sets its text; it also records one outbox item ranked
  high in PRD 7's outbox (via the `omni item new` writer) asking a person to agree to postpone it,
  high even when the agent proposes medium (never#2).
- `omni ship <n>` refuses while a `later` reply on the feature PR or a merged sub-PR has no file,
  naming the PR and the reply's first words (the test that would have caught the review's item 1
  review promises); refuses a `later` reply with no outbox item of its thread; ships once both exist;
  when GitHub cannot be read prints `not judged: could not read the review threads of PRD <n>'s pull
  requests: <why>` and exits 1, never a pass (BL-GATE-1).
- `/omni:pr-care` replies `later` whenever it offers to do the point afterwards, then commits the
  file alone as `docs(follow-up): <slug>`.

### s4
- With two files, `omni status` prints `follow-ups  2 open · oldest <older date> → omni follow-up list`
  under the bar; with none, no follow-ups line.

### s5 (light: docs only)
- `docs/guide/loop.md` says what goes in `follow-ups/`, that nothing opens an issue or notifies,
  and that a person closes a point by deleting its file.
