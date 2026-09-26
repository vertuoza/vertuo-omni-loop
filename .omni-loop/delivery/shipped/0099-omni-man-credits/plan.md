# OmniMan credits — plan

**PRD:** #99 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/omni-man-credits` →
`main` (`Closes #99`) · **Sub-PRs:** `feat/omni-man-credits--<slice>` → the feature branch
(`Part of #99`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**Build order:**
- **Wave 1 is the tracer.** s1 makes the signature exist end to end: the config section and its
  default, the pure signature module, `omni sign`, `omni init` writing the section, and `omni phase0`
  enforcing it.
- **Wave 2** puts it to use on two independent sides: the skills sign their work (s2), and
  `omni credits` counts the pull requests (s3).
- **Wave 3** finishes the report: issues, the app's own issues, co-authored commits, `--list` and
  `--json` (s4).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The signature exists: a `signature` config section defaulting to OmniMan (`name`, `email` = the omni-loop bot's noreply address, `footer`), `signature: null` accepted and unknown keys refused; a pure signature module (the trailer, the footer with `<!-- omni-loop:signed -->`, whether a body is signed, whether a message carries the exact trailer, the bot login in a noreply address); `omni sign trailer` and `omni sign footer`, printing nothing when signing is off; `omni init` writing the section; `omni phase0` refusing a commit in its range without the trailer; the doc comment in `banter.mjs` naming the exception | `kit/lib/config.` `kit/lib/signature.` `kit/bin/commands/sign.` `kit/bin/commands/index.` `kit/bin/sign.` `kit/lib/init/config-text.` `kit/bin/commands/init.` `kit/bin/init.test.mjs` `kit/bin/commands/phase0.` `kit/bin/phase0.test.mjs` `kit/lib/policy/phase-0.` `kit/porting/policy--phase-0.md` `kit/lib/outbox/banter.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | The skills sign the loop's work: in the eight skills, every commit ends with the session's co-author trailer and then the line `omni sign trailer` prints, and every pull request and issue a skill opens ends with the line `omni sign footer` prints, just above the session's own attribution lines; comments stay unsigned; the porting notes of the seven ported skills record the change; `kit/test/plugin.test.mjs` holds every SKILL.md to both rules | `kit/plugin/skills/` `kit/porting/plugin--` `kit/test/plugin.test.mjs` | s1 | 2 |
| s3 | `omni credits` counts OmniMan's pull requests across the organisation: it reads, through `gh`, the pull requests carrying a loop label or the signature marker and the co-authored commits on default branches; a pull request is his by label, marker or co-authored merge commit; kinds from labels; merged and open counted, closed-unmerged ignored; `signed`, `before signing` and `missed` around each repository's first signed item; the text report's pull request lines, by repository and by month; `--repo` and `--since`; `signature: null`; `gh` missing, logged out or rate limited exits 2; a query at the 1,000-result cap warns | `kit/lib/credits/` `kit/bin/commands/credits.` `kit/bin/commands/index.` `kit/bin/credits.` `kit/dist/omni.mjs` | s1 | 2 |
| s4 | `omni credits` finishes the record: PRD issues (label or marker), issues and pull requests opened by the bot account (`Opened by the app`), the count of co-authored commits on default branches, `--list` (one line per item, oldest first) and `--json` (the whole report as one document, with each item's reasons) | `kit/lib/credits/` `kit/bin/commands/credits.` `kit/bin/credits.` `kit/dist/omni.mjs` | s3 | 3 |

**Shared ground.**
- **`kit/dist/omni.mjs`** is declared by s1, s3 and s4, the three slices that change code the bundle
  holds; `kit/test/dist.test.mjs` fails unless each rebuilds it with `pnpm kit:build`. The waves keep
  them apart: s1 in wave 1, s3 in wave 2, s4 in wave 3. s2 changes only skill prose, which the
  bundle does not hold.
- **`kit/bin/commands/index.`** (the command table, one line per command) is declared by s1 (`sign`)
  and s3 (`credits`), in waves 1 and 2.
- **`kit/lib/credits/`, `kit/bin/commands/credits.` and `kit/bin/credits.`** are s3's and s4's, in
  waves 2 and 3: s4 extends what s3 builds.
- **`kit/plugin/skills/` and `kit/porting/plugin--`** are s2's alone. `kit/porting/policy--phase-0.md`
  is s1's, and shares no prefix with them.

## Per slice: done when

**s1**
- `omni config` in a repository with no `signature` section prints `name: OmniMan`,
  `email: 333776611+omni-loop-invader[bot]@users.noreply.github.com` and the footer
  `🦸 Delivered by OmniMan, with Omni Loop` (AC 1).
- A config with an unknown key under `signature` is refused, naming the key; `signature: null` is
  accepted (AC 2).
- `omni sign trailer` prints exactly
  `Co-authored-by: OmniMan <333776611+omni-loop-invader[bot]@users.noreply.github.com>`;
  `omni sign footer` prints the footer followed by `<!-- omni-loop:signed -->`; with
  `signature: null` both print nothing and exit 0 (AC 3).
- The config `omni init` writes carries the `signature` section with the default values, and parses
  (AC 4).
- `omni phase0` on a range with an unsigned commit prints `not ok`, naming the commit and the missing
  line, and exits 1; a signed range prints `ok` as before; with `signature: null` the signature is
  not checked (AC 6).
- The signature module's unit tests cover a trailer with another name or another address as not
  his, and a non-noreply address as no bot login.
- `kit/test/no-literals.test.mjs` stays green; `pnpm test` passes with `kit/dist/omni.mjs` rebuilt
  (AC 11).

**s2**
- Every SKILL.md that asks for the session's co-author trailer also names `omni sign trailer`, and
  every SKILL.md that opens a pull request or an issue names `omni sign footer`; `plugin.test.mjs`
  fails on a fixture skill that drops either (AC 5).
- The PRD issue, phase-0, feature, sub-PR, rework, terraform and standalone pull request steps each
  place the footer above the session's own attribution lines; no skill signs a comment.
- Each of the seven porting notes (`kit/porting/plugin--*.md`) records the change.
- `pnpm test` passes.

**s3**
- On fixtures through a stubbed `exec`, a pull request counts as OmniMan's when only its label, only
  its marker, or only a co-authored merge commit (`(#<n>)` at the end of its subject) says so (AC 7).
- Merged and open pull requests count, closed-unmerged ones do not; each is sorted as `phase-0`,
  `feature`, `slice` or `other` (AC 7).
- In each repository, an unsigned pull request created before its first signed item is
  `before signing`, and one created after it is `missed` (AC 7).
- `--repo` narrows to one repository and `--since YYYY-MM` to items created from that month on
  (AC 9, first half).
- With `signature: null` the pull requests still count and the signature line reads
  `signing is off in this repository`.
- `gh` missing, logged out or rate limited exits 2 with one line saying so; a query at the
  1,000-result cap prints the report and a warning naming the query (AC 10).
- `pnpm test` passes with `kit/dist/omni.mjs` rebuilt (AC 11).

**s4**
- `omni credits` counts PRD issues by label or marker, lists the issues and pull requests opened by
  the bot account under `Opened by the app`, and prints the count of co-authored commits on default
  branches (AC 8).
- `--list` prints one line per item, oldest first: repository, number, kind, state, created date,
  signature, title; `--json` prints the whole report as one JSON document: the scope, the totals,
  every item with its classification and reasons (`label`, `marker`, `commit`, `author`), the
  commits and the warnings (AC 9, second half).
- `pnpm test` passes with `kit/dist/omni.mjs` rebuilt (AC 11).

**After the merge (AC 12, by hand, not a slice):** a commit a skill makes shows OmniMan's avatar
beside Claude's on GitHub, and the next feature pull request's squash-merge commit on `main` keeps
him.
