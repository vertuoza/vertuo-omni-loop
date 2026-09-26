---
prd: 99
title: OmniMan signs the loop's work, and omni credits counts it
blocked-by: none
spec: file
---

# OmniMan signs the loop's work, and omni credits counts it

**Date:** 2026-09-25 · **PRD:** #99 · **Changes:** the kit (`kit/lib`, `kit/bin`, the eight skills
in `kit/plugin`, their porting notes, `kit/dist/omni.mjs`); the game, the arcade and the GitHub App
do not change

## Problem

When a pull request made by the loop is merged, Claude shows as an author and OmniMan does not.

- **Commits.** Every commit a skill makes ends with the session's `Co-authored-by: Claude
  <noreply@anthropic.com>` trailer. GitHub links that address to Claude's account, so Claude's
  avatar sits beside the person's on the commit, and on `main` once the pull request is
  squash-merged (`c6f93fb` carries it). Nothing names the loop.
- **Pull requests and issues.** They are opened by the person, "via claude": the cloud session
  calls GitHub through the Claude GitHub App on the person's behalf. GitHub gives that badge to the
  app that makes the call, and an issue has only one. A body can end with a line, as Claude's
  "Generated with Claude Code" does; the loop adds none.
- **No record.** Nobody can say how many pull requests the loop has worked on, in which
  repositories, or since when. The only trace is the `omni:*` labels, and labels are renamed (#48)
  and removed.

OmniMan already has a GitHub identity: the omni-loop GitHub App, registered as `omni-loop-invader`
(app 5073302), which posts the **outbox** check and whose logo is OmniMan. Its bot account,
`omni-loop-invader[bot]`, has the user id 333776611, read from its outbox comment on #73.

## Solution

OmniMan becomes a co-author of every commit the loop makes and signs every pull request and issue
it opens, by default, in every repository the loop is installed in. A new command, `omni credits`,
counts what he did across the organisation.

### The signature

A new config section, `signature`, with three keys and a kit default:

```yaml
signature:
  name: OmniMan
  email: 333776611+omni-loop-invader[bot]@users.noreply.github.com
  footer: "🦸 Delivered by OmniMan, with Omni Loop"
```

- A repository with no `signature` section signs with the default. `signature: null` switches
  signing off. An unknown key under `signature` is refused, as everywhere in the config.
- `omni init` writes the section, with the default values, into every new
  `.omni-loop/config.yml`, under a comment saying what it is, so it is visible and editable rather
  than hidden in the kit.
- Repositories already installed need no change: they get the default.

### Signing

Two new subcommands print the lines, so no skill spells a name or an address:

- `omni sign trailer` prints `Co-authored-by: <name> <email>`.
- `omni sign footer` prints the footer followed by a hidden marker, `<!-- omni-loop:signed -->`.
  The marker is what `omni credits` recognises, whatever the footer's wording.
- With `signature: null` both print nothing and exit 0, so a skill runs unchanged.

The eight skills (`brainstorm`, `plan`, `pr`, `do-work`, `wave`, `yolo`, `yolo-fix`, `terraform`)
change where they commit and where they open a pull request or an issue:

- **Every commit** a skill makes ends with the session's co-author trailer, then the line
  `omni sign trailer` prints: the PRD, plan, claim, slice, settle, adopt, ship and terraform
  commits.
- **Every pull request and issue** a skill opens ends with the line `omni sign footer` prints, just
  above the session's own attribution lines: the PRD issue, the phase-0 pull request, the feature
  pull request, every sub-pull request (slice and rework), the terraform pull request and a
  standalone pull request. A body a skill rewrites later keeps its footer.
- Comments are not signed.
- A commit a person makes by hand is not signed. Only the loop's own work carries OmniMan.

When a feature pull request is squash-merged, GitHub gathers the co-authors of the branch's commits
into the merge commit, so OmniMan also shows on `main`.

### The guard

`omni phase0` also checks that every commit in its range carries the trailer `omni sign trailer`
prints. A phase-0 branch is made only by the loop, so an unsigned commit there is a miss:

```text
not ok — unsigned: a1b2c3d has no "Co-authored-by: OmniMan <333776611+omni-loop-invader[bot]@users.noreply.github.com>" line
```

The existing docs-only and carries checks are unchanged. With `signature: null` the signature
check is skipped. `omni ship` checks nothing new.

### `omni credits`

```text
omni credits [--repo <owner/name>] [--since <YYYY-MM>] [--list] [--json]
```

It reads GitHub on demand through the `gh` login, over the organisation that owns `repo.slug`
(`--repo` narrows it to one repository, `--since` to items created from that month on). It stores
nothing.

**What it reads:**

- pull requests carrying `labels.phase0`, `labels.feature` or `labels.sub`;
- pull requests and issues whose body contains the signature's `name`, kept only when the body
  carries the marker;
- commits on default branches whose message contains the signature's `name`, kept only when the
  message carries the exact trailer line; the pull request a commit merged is the `(#<n>)` at the
  end of its subject;
- issues carrying `labels.prd`;
- issues and pull requests opened by the signature's bot account (the login in the email, between
  `+` and `@`), such as the app's retro issues.

**Whose it is.** A pull request is OmniMan's when **any one** of these holds: it carries a loop
label, its body carries the marker, or a commit carrying his trailer merged it. Every phase-0,
feature and slice pull request is his, signed or not. An issue is his when it carries
`labels.prd`, its body carries the marker, or his bot account opened it.

**How each one is classified:**

| Field | Values |
|---|---|
| kind (pull requests) | `phase-0`, `feature`, `slice` (`labels.sub`: slices and reworks), `other` |
| state (pull requests) | `merged`, `open`. A pull request closed without merging is not counted. |
| signature | `signed`: the body carries the marker, or a commit carrying his trailer merged it. `before signing`: unsigned, created before that repository's first signed item. `missed`: unsigned, created after it. `by the app`: opened by his bot account. |

**What it prints:**

```text
OmniMan · vertuoza · all time
PRs        56   (merged 53 · open 3)      phase-0 5 · feature 4 · slices 45 · other 2
  signed 12 · before signing 44 · missed 0
PRD issues 26   signed 4 · before signing 22 · missed 0
Opened by the app: 9 issues
Co-authored commits on default branches: 11
By repo    vertuo-omni-loop 47 · vertuo-core 9
By month   2026-07 8 · 2026-08 21 · 2026-09 27
```

- `--list` adds one line per item, oldest first: repository, number, kind, state, created date,
  signature, title.
- `--json` prints the whole report as one JSON document instead: the scope, the totals, every item
  with its classification and the reasons it counts (`label`, `marker`, `commit`, `author`), the
  commits, and the warnings.
- With `signature: null` the pull requests and issues are still counted (the label decides whose
  they are), and the signature line reads `signing is off in this repository`.

## Decisions

1. **OmniMan is the omni-loop app's bot account**, not a machine user and not a bare address. It is
   free, it exists, its avatar is OmniMan, and no token is handed out. It has no contribution
   graph: `omni credits` is his record.
2. **The skills sign, through `omni sign`**, rather than a git hook. It works in every session,
   cloud or local, with nothing installed, and it signs only what the loop made.
3. **Signing is on by default and named OmniMan in the kit.** This is an explicit exception to "the
   kit never mentions the game" (`kit/lib/outbox/banter.mjs`): OmniMan is the loop's signing
   identity and the omni-loop app's face, both on the delivery side. The banter pool keeps its rule,
   and the doc comment in `banter.mjs` names this exception.
4. **Whose a pull request is does not rest on labels alone.** A label, the marker, or a co-authored
   merge commit is enough. The signature is a breakdown inside his total, never a filter.
5. **History counts.** Loop pull requests from before signing are his, shown as `before signing`.
6. **Only `omni phase0` enforces the signature.** A feature branch may carry a person's hand-made
   commit, so `omni ship` refusing it would push OmniMan's credit onto work he did not do. `missed`
   in `omni credits` shows what a skill forgot.
7. **Pull request and issue bodies are signed; comments are not.**
8. **`omni credits` reads GitHub on demand** and keeps no state. An OmniMan card in the galaxy
   arcade is a later PRD.
9. **A pull request closed without merging does not count.**

## User stories

- As a person merging a pull request the loop made, I see OmniMan's avatar beside Claude's on its
  commits, and on `main` after the squash merge, so I can tell the loop built it.
- As a reader of a pull request or an issue the loop opened, I see OmniMan's footer at the end of
  its description.
- As a PM, I run `omni credits` and see how many pull requests OmniMan worked on, of which kinds, in
  which repositories and in which months; `omni credits --list` tells me which ones.
- As the maintainer of another repository, I install the loop and OmniMan signs with nothing to
  configure; `signature: null` switches it off.
- As a kit maintainer, I see `missed` in `omni credits` when a skill forgot to sign, and fix the
  skill.

## Scope

**In:**

- `kit/lib/config.mjs`: the `signature` section and its default.
- A pure signature module: the trailer, the footer with its marker, whether a body is signed,
  whether a message carries the trailer, the bot login in an email.
- `omni sign trailer` and `omni sign footer`.
- `kit/lib/init/config-text.mjs`: `omni init` writes the `signature` section.
- `omni phase0`: the signature check.
- `omni credits`: its GitHub reader, its classifier and its report.
- The eight skills and the porting notes of the seven that have one (`kit/porting/plugin--*.md`).
- The doc comment in `kit/lib/outbox/banter.mjs` naming the exception.
- `kit/dist/omni.mjs`, rebuilt with `pnpm kit:build`.

**Out:**

- An OmniMan card or stats in the galaxy arcade, or a line in the Hall of Heroes (a later PRD).
- A git hook, and any signing of a person's hand-made commits.
- Pull requests or issues authored by the app itself through its own token.
- Signing comments.
- Rewriting past commits or bodies to add the signature.
- Counting pull requests closed without merging.

## Test seams

All tests run on fixtures and never call GitHub (`omni kb show testing`).

- **The signature module**, a pure unit: the lines built from a config, the marker found or not, a
  trailer matched exactly (another name or another address is not his), the bot login read from a
  noreply address and `null` from any other.
- **The config**, `kit/lib/config.test.mjs`: the default, an override, `signature: null`, an
  unknown key refused.
- **`omni init`**: the written config carries the `signature` section and parses.
- **`omni sign`**, through `main()` on a fixture repository (`makeRepo()` in `kit/test/fixture.mjs`):
  both lines, and nothing with `signature: null`.
- **`omni phase0`**, `kit/bin/phase0.test.mjs`: a signed range passes, an unsigned commit is named
  and refused, signing off skips the check, the existing verdicts are unchanged.
- **The credits classifier**, a pure unit over fixture pull requests, issues and commits: the three
  ways a pull request becomes his and each alone is enough; kinds from labels; merged and open
  counted, closed-unmerged ignored; `signed`, `before signing` and `missed` around a repository's
  first signed item, per repository; `by the app`; `--since` and `--repo`; `signature: null`.
- **The credits reader**, with a stubbed `exec`, the way `game/sources/github.mjs` is tested: the
  queries it asks `gh` for, the 1,000-result cap turned into a warning, a missing or logged-out
  `gh` and a rate limit turned into errors.
- **`omni credits`**, through `main()`: the text report, `--list` and `--json` on one fixture.
- **The skills**, `kit/test/plugin.test.mjs`: every SKILL.md that asks for the co-author trailer
  also names `omni sign trailer`, and every one that opens a pull request or an issue names
  `omni sign footer`. The existing check that every `omni` command a SKILL.md names exists covers
  `sign` and `credits`.
- **`kit/test/no-literals.test.mjs`** stays green.

## Risks

- **A merge publishes the kit.** `kit/dist/omni.mjs` (what the one-line install runs) and
  `kit/plugin` (what the plugin marketplace serves) change on merge (`omni kb show releasing`), so
  every repository using the kit starts signing with OmniMan on its next loop run. Rollback: revert
  the feature pull request, which returns both; or `signature: null` in one repository's config.
  Commits already signed keep their trailer, which is harmless.
- **GitHub may not link the address to the bot.** If the id is wrong or GitHub does not show a bot
  as a co-author, the trailer stays plain text: no avatar, but `omni credits` still counts. The live
  check below catches it; the fix is the default address.
- **Search limits.** GitHub search returns at most 1,000 results a query and allows about 30 search
  requests a minute. `omni credits` warns when a query hits the cap; `--since` and `--repo` narrow
  it.
- **Old labels.** History before the `omni:` prefix (#48) counts only where those pull requests
  carry today's labels.
- **Anyone can copy the footer.** A person's pull request carrying the marker counts as his. That is
  accepted: the marker is only ever written by `omni sign footer`.
- **Private repositories** count only as far as the `gh` login can see them.

## Acceptance criteria

1. `omni config` in a repository whose config has no `signature` section prints `signature` with
   `name: OmniMan`, `email: 333776611+omni-loop-invader[bot]@users.noreply.github.com` and the
   footer `🦸 Delivered by OmniMan, with Omni Loop`.
2. A config with an unknown key under `signature` is refused, naming the key; `signature: null` is
   accepted.
3. `omni sign trailer` prints exactly
   `Co-authored-by: OmniMan <333776611+omni-loop-invader[bot]@users.noreply.github.com>`, and
   `omni sign footer` prints the footer followed by `<!-- omni-loop:signed -->`. With
   `signature: null` both print nothing and exit 0.
4. The config `omni init` writes carries the `signature` section with the default values, and
   parses.
5. Every SKILL.md that asks for the session's co-author trailer also names `omni sign trailer`, and
   every SKILL.md that opens a pull request or an issue names `omni sign footer`.
6. `omni phase0` on a range with a commit lacking the trailer prints `not ok`, naming that commit
   and the missing line, and exits 1; on a signed range it prints `ok` as before; with
   `signature: null` it does not check the signature.
7. `omni credits` on fixtures counts a pull request as OmniMan's when only its label, only its
   marker, or only a co-authored merge commit says so; counts merged and open pull requests and not
   closed-unmerged ones; sorts them by kind; and classifies each as `signed`, `before signing` or
   `missed` around its repository's first signed item.
8. `omni credits` counts PRD issues and issues opened by the bot account, and the co-authored
   commits on default branches.
9. `omni credits --repo`, `--since`, `--list` and `--json` narrow, list and serialise as described.
10. `omni credits` with `gh` missing or logged out, or rate limited, exits 2 with one line saying
    so; a query that hits the 1,000-result cap still prints the report, with a warning naming the
    query.
11. `pnpm test` passes, and `kit/dist/omni.mjs` is rebuilt from the changed source.
12. By hand, once merged: a commit a skill makes after the merge shows OmniMan's avatar beside
    Claude's on GitHub, and the squash-merge commit on `main` of the next feature pull request
    keeps him.
