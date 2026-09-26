---
prd: 68
title: /omni:invade — explore a repository and set up its knowledge base
blocked-by: [45]
spec: file
---

# /omni:invade — explore a repository, set up its knowledge base

**Date:** 2026-09-25 · **PRD:** #68 · **Follows:** #45 (knowledge forms, `/omni:terraform`), #39
(`omni init`), #3 (the kit, §6 knowledge) · **Inspired by:** fieldnote's `PROFILE.md`
(`dervalp/fieldnote-skills`): hooks that point at what a repository already has

## Problem

PRD 45 gives the kit its **how-to-work** half: the playbook forms, filled by `/omni:terraform`. It
leaves the **truth** half alone. The registers (`product/`, `domains/`, `cross-domain/`) hold
principles (`P-`), business rules (`BR-`) and invariants (`N-`), and nothing fills them. A repository
that installs the loop starts with empty registers and `laws.source: none`, even when it already
writes its business rules down in its own pages, or enforces them in its tests and schema.

Two things are missing:

1. **Reuse.** A repository's own `docs/business-rules.md` cannot be pointed at: the loop cites a law
   by id (`bearsOn: BR-QUOTE-1`), and a page in the repository's own format has no ids. Copying the
   text into the registers makes two sources that drift.
2. **Inference.** Where nothing is written, the truth is still in the code: a test that refuses an
   expired quote, a database constraint, a schema. Nobody reads it out.

And the survey `/omni:terraform` runs is one pass looking for pages that answer each form. It does
not study how the repository is built — its domains, its boundaries, where its rules live — before
writing.

Last, the skill's name. The loop is a galaxy of invaders; a repository the loop moves into is
**invaded**, not terraformed.

## Solution

### In plain words

`/omni:invade` does four things, in order:

1. **Explores** the repository in depth: its domains, where its rules are written, where its ADRs
   are, what its code enforces.
2. **Shows one map** and asks everything at once: "these domains; rules in `docs/rules.md`; ADRs in
   `docs/adr` — point at them or repatriate them?" The person answers in one message.
3. **Writes the knowledge base.** A rule already written somewhere gets a short **index entry** that
   points at it. A rule written nowhere is **drafted** from the code. The playbook forms are filled as
   PRD 45's terraform fills them.
4. **Opens one docs-only pull request** a person reviews and merges.

**One safety rule:** every register entry invade writes is **proposed**. A proposed entry never binds a
slice. It becomes a law only when a person removes its `Proposed:` line.

### 1. The rename: terraform → invade

Everything PRD 45 named `terraform` is renamed:

| PRD 45 | This PRD |
|---|---|
| `/omni:terraform` (`kit/plugin/skills/terraform/`) | `/omni:invade` (`kit/plugin/skills/invade/`) |
| `branches.terraform`, default `docs/omni-terraform` | `branches.invade`, default `docs/omni-invade` |
| form front matter `terraformed: <date>` | `invaded: <date>` |
| slot marker `by: terraform` | `by: invade` |
| `omni init`'s closing step naming `/omni:terraform` | names `/omni:invade` |
| "the repository is not terraformed" (every skill's step 0, the config error) | "the repository is not installed" |

The form parser still **reads** the old spellings (`terraformed:`, `by: terraform`), so a form written
before this PRD parses; `omni check kb` warns on each, naming the file. `branches.terraform` is not
kept: the config schema refuses it with a message naming `branches.invade`.

### 2. A proposed entry

A register entry may carry one new field line:

```markdown
## BR-QUOTE-1
A quote expires 30 days after it is sent.
Serves: P-QUOTE-1
Source: docs/business-rules.md#quote-expiry
Enforced by: tests/Quote/ExpiryTest.php
Stated: 2026-09-25
Proposed: invade 2026-09-25
```

- **`Proposed: <who> <YYYY-MM-DD>`.** The parser reads it as `proposed`. The id still resolves: an
  outbox item may say `bearsOn: BR-QUOTE-1`.
- **Not a law.** `laws.floorsHigh` is false for a proposed id, under every `laws.source`. A proposed
  entry never stops a slice and never floors an outbox item high.
- **Relaxed where a person has not spoken yet.** `omni check knowledge` lets a proposed principle go
  without `Decided:`, and lets a rule serve a proposed principle. Every other check holds: a `Source:`
  or `Enforced by:` path that does not exist, or an anchor with no heading, still fails.
- **Visible.** `omni check knowledge` warns (exit `0`) once per proposed entry, naming its file and
  id. `omni knowledge <id>` prints `proposed by <who> on <date>`. `omni kb status` prints, per register
  folder, how many entries are laws and how many are proposed.
- **Confirmed by a person,** in any later pull request: delete the `Proposed:` line, and add `Decided:`
  to a principle. From then on the checker grades it as a law.

### 3. An index entry

An entry drawn from a page the repository already has is an **index entry**: an id, a one-line
statement, and `Source: <path>#<anchor>` naming the heading the rule sits under. The page stays the
full text; the entry is the id the loop cites. The checker already refuses a `Source:` whose file or
anchor does not exist. An index entry needs no new field. Like every entry invade writes, it is
proposed.

### 4. `/omni:invade`

PRD 45's `/omni:terraform`, renamed, with its seven steps kept — step 0, `omni kb init`, the playbook
survey, point before writing, fill from evidence, leave holes, the config diff, one docs-only pull
request, `--refresh`, and never rewriting a `by: human` section — and extended as follows.

1. **Step 0** as PRD 45's, reading `branches.invade`.
2. **The exploration round.** Four read-only subagents, one per facet, each returning a short report,
   never file dumps:
   - **domains** — the repository's domains and their boundaries: modules, packages, bounded
     contexts, folder names. Each becomes a proposed `domains/<domain>/` folder with its code (the
     folder name uppercased, hyphens removed).
   - **written truth** — every page that states a principle, a business rule or an invariant, found by
     name and by content anywhere in the tree (never at a fixed path), each rule with the heading it
     sits under.
   - **enforced truth** — what the code proves: tests whose names state a rule, database constraints,
     schemas, validation, types. Each with the file that enforces it.
   - **decisions and words** — ADR folders (`adr`, `adrs`, `decisions`), glossaries, agent context
     files (`CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`), and the pages PRD 45's playbook survey looks for.
3. **The map: one checkpoint.** Invade prints one map in chat — the domains; every source found, each
   with its default; the number of entries each would produce — and asks, as one numbered list:
   - each **domain**: keep, rename or drop;
   - each **truth page**: **index** it (default) or **context only** (added to `paths.context`, no ids);
   - the **ADR folder**, when it is outside `.omni-loop/`: **point** at it (default: `paths.adr`
     names it, the decisions form is a pointer) or **repatriate** it (copied into the front door's
     `adr/`, `paths.adr` left there; the originals are never deleted);
   - **drafting from code**: on (default) or off.

   The person answers in one message. Nothing is written before that answer. A reply that changes a
   default is taken as said; one that does not mention an item takes its default.
4. **Write the registers.**
   - One **index entry** per rule, principle or invariant found in an indexed page.
   - When drafting is on, one **drafted entry** per truth the code enforces and no page states: an
     invariant with `Enforced by: <the file>`, or a rule, plus the principle it serves when none fits.
     A drafted principle's `Why:` says what in the code suggests it.
   - Every entry: `Stated: <today>` where its kind requires it, and `Proposed: invade <today>`.
   - Never an entry that repeats one already in the registers; never a change to an entry a person
     wrote.
   - Ids number on from the highest id already in the file.
5. **Fill the playbook** as PRD 45's terraform does.
6. **The config diff,** PRD 45's, plus: `paths.adr` from the map; each context-only page added to
   `paths.context`; and `laws.source: knowledge` whenever the registers hold at least one entry — safe
   while every entry is proposed, since proposed entries floor nothing.
7. **One docs-only pull request** on `branches.invade`, through `/omni:pr`'s standalone kind. Its body
   holds the map as answered, one checkbox per playbook hole, and, per register file, the count of
   proposed entries with a line on how to confirm them. `omni check knowledge` and `omni check kb` run
   green before it is opened (warnings allowed).

`/omni:invade --refresh` does PRD 45's refresh, and re-runs only the exploration facets whose sources
changed since the last invade. It never touches a confirmed entry.

### 5. The other skills

- **`/omni:yolo`** prints, once at start, beside PRD 45's open questions: `<n> proposed knowledge
  entries — not laws until confirmed`. Delivery carries on.
- **`/omni:do-work`** reads proposed entries like any other (they describe the product), and records an
  outbox item with `bearsOn` a proposed id where it applies. It never stops on one.

## Decisions

Decided 2026-09-25 by the PRD author in the brainstorm:

1. **A new PRD, blocked by 45.** PRD 45 ships as planned; this PRD extends its skill.
2. **Reuse means index entries:** an id, a statement, `Source:` back to the page. No copies, nothing
   written outside `.omni-loop/`.
3. **Drafting covers every kind** — principles, rules and invariants — from the code, the README and
   names, when no page states them.
4. **Proposed, in place.** A `Proposed:` line on the entry, in its normal register file. It resolves
   but never floors; a person confirms by deleting the line. Merging the invade pull request confirms
   nothing.
5. **One map checkpoint** after the exploration round, answered in one message; the ADR choice (point
   or repatriate) is asked there.
6. **Named `/omni:invade`,** renamed from `terraform` in this PRD's first slice, not inside PRD 45.

Taken while writing the spec, open to objection on the phase-0 PR:

7. **Old spellings still parse** (`terraformed:`, `by: terraform`) with a warning, so a form written
   between PRD 45 and this PRD needs no hand edit. `branches.terraform` is refused, not aliased: it
   is a config key a person set by hand, and a clear error beats a silent alias.
8. **Every entry invade writes is proposed, index entries included.** A page a person wrote is not a
   decision that the loop should stop on it; the person says so by confirming.
9. **`laws.source: knowledge` is proposed as soon as an entry exists,** because proposed entries
   floor nothing: flipping early costs nothing and each confirmation then takes effect at once.
10. **Repatriating ADRs copies, never deletes.** Deleting the originals is outside `.omni-loop/` and a
    person's call.

## User stories

- As a **team adopting the loop** on a repository that already writes its rules down, I run
  `/omni:invade`, answer one map, and get a pull request whose registers point at my pages, not copies
  of them.
- As a **team with no written rules**, I get drafts of what my code already enforces, and confirm them
  one by one.
- As an **agent running `/omni:do-work`**, I read what the product says is true before building, and
  a draft nobody confirmed never stops me.
- As a **person opening `.omni-loop/knowledge/`**, I see which entries are laws and which are still
  proposals.

## Scope

**In:** the rename (skill, `branches.invade`, `invaded:`, `by: invade`, `omni init`'s closing step,
the "not installed" wording, the old spellings read with a warning); the `Proposed:` field in the
register parser, `omni check knowledge`, `laws.floorsHigh`, `omni knowledge <id>` and `omni kb
status`; `/omni:invade` with its exploration round, map checkpoint, register writing, config diff and
`--refresh`; `/omni:yolo`'s proposal count; `/omni:do-work`'s line on proposed entries; the rebuilt
bundle.

**Out:** changing the register layout or the forms; a command that confirms entries (a person edits
the line); deleting anything outside `.omni-loop/`; running invade on any repository as part of this
PRD.

**Human steps** (never taken by the work):

1. Merge PRD 45 first.
2. After this PRD ships, run `/omni:invade` on `vertuoza/vertuo-workflow-domain` (PHP), the kit's
   acceptance repository (PRD 39), and review its pull request.

## Test seams

All in the root vitest suite (`pnpm test`):

- **The rename:** the config tests (`branches.invade` default; `branches.terraform` refused naming
  `branches.invade`); the form parser tests (`invaded:` and `by: invade` read; the old spellings read
  and warned on by `omni check kb`); `kit/bin/init.test.mjs` (the closing step names `/omni:invade`);
  `kit/bin/omni.test.mjs` (the "not installed" message).
- **The register parser and checker:** fixture registers with a proposed principle without
  `Decided:`, a rule serving it, and a proposed entry with a dead `Source:` anchor (still fails).
- **`laws`:** `floorsHigh` false for a proposed id under `knowledge`, true for the same id confirmed.
- **The commands:** `omni knowledge <id>` and `omni kb status` on a fixture holding laws and proposals.
- **The bundle:** `kit/test/dist.test.mjs` keeps `kit/dist/omni.mjs` equal to a fresh build.
- **The skills:** `kit/test/plugin.test.mjs` (frontmatter, every `omni <command>` named exists, no
  skill named `terraform`).

## Risks

- **Drafts become laws by rubber stamp.** Merging the pull request confirms nothing; each entry needs a
  person to delete its `Proposed:` line.
- **Drafting promotes an accident of today's code into a rule.** It stays a proposal, its `Why:` says
  what suggested it, and it never stops a slice.
- **Too many proposals to read.** The map shows the counts before anything is written, and drafting can
  be turned off there.
- **The exploration costs tokens.** Four subagents, each returning a short report; `--refresh` re-runs
  only the facets whose sources changed.
- **The rename breaks a form written between the two PRDs.** Old spellings still parse, with a warning.
- **The committed bundle is shared ground.** Every slice that changes bundled code rebuilds and commits
  `kit/dist/omni.mjs`; the plan keeps them in separate waves.

## Acceptance criteria

1. `omni config` prints `branches.invade: docs/omni-invade` when unset; a config holding
   `branches.terraform` is refused with a message naming `branches.invade`.
2. A form with `invaded: <date>` and `by: invade` markers parses; a form with `terraformed:` or
   `by: terraform` parses too, and `omni check kb` warns once per old spelling, naming the file.
3. `omni init` in a fixture repository names `/omni:invade` in its closing steps; no skill, test or
   message in `kit/` names `terraform` except the parser's old-spelling reader and its tests.
4. A fixture register with a proposed principle lacking `Decided:` and a rule serving it passes
   `omni check knowledge` with one warning per proposed entry; a proposed entry whose `Source:` anchor
   does not exist fails it.
5. Under `laws.source: knowledge`, `floorsHigh` is false for a proposed id and true once its
   `Proposed:` line is removed; `resolve` succeeds for both.
6. `omni knowledge <id>` prints `proposed by invade on <date>` for a proposed entry; `omni kb status`
   prints the laws and proposals count per register folder.
7. `/omni:invade` is in the plugin, names only commands the CLI has, and states: the four exploration
   facets; the one map checkpoint with its four kinds of question and their defaults; that nothing is
   written before the answer; index entries with `Source: <path>#<anchor>`; drafted entries; every
   entry `Proposed: invade <date>`; ADRs pointed or copied, never deleted; the config diff including
   `laws.source`; the one pull request; `--refresh`; and the `by: human` rule.
8. `/omni:yolo` prints the proposed-entry count once at start; `/omni:do-work` says a proposed entry
   never stops a slice.
9. `kit/dist/omni.mjs` equals a fresh build.
