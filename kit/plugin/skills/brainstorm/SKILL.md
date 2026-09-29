---
name: brainstorm
description: Turns an idea into an approved design, then into a PRD the loop can build — the PRD issue, the spec, the before/after page and the pending acceptance scenarios in the PRD's inbox folder, its plan through /omni:plan, and a docs-only phase-0 PR a person reviews and merges before any code is written. Use before any change someone wants made. Writes no code, merges nothing. Ends with the /omni:yolo line. Triggers on "brainstorm", "I have an idea", "let's design this", "turn this into a PRD", "/omni:brainstorm".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-brainstorming/SKILL.md (with the superpowers brainstorming steps written in) — changes in kit/porting/plugin--brainstorm.md -->

# Brainstorm: an idea into a PRD the loop can build

An idea in; out come an approved design, the PRD issue, its inbox folder (spec, before/after page,
pending acceptance scenarios), its plan and draft feature PR, and a docs-only **phase-0 PR**. It ends
at a review gate, not at delivery: a person merges the phase-0 PR, then runs `/omni:yolo`.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the repository
is not installed. Keep the JSON; later steps read `repo.*`, `branches.feature`, `branches.phase0`,
`worktrees`, `paths.*`, `labels.*`, `prLinks.*`, `acceptance.*` and `limits.beforeAfterMaxBytes`
from it. `<remote>` below is `repo.remote`.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

Then, before your first question, follow `/omni:dossier-open` with one line of the idea: it opens a
draft dossier for it on the Omni page, linked to this Claude session, and prints its link as
"follow along at …", which the person can send to whoever the idea is for. Whatever it prints,
carry on to step 1: a draft that did not open stops nothing.

## 1. Brainstorm the design

This step is a conversation with the person who has the idea. Everything they decide here is asked,
never assumed; nothing below it starts before the design is approved. Read-only exploration of the
repository is allowed throughout.

**Establish shared understanding first.**

1. **Discover intent:** the outcome wanted, who it is for, what success looks like. When the request
   does not say, ask one focused question about purpose before proposing anything.
2. **Write back your understanding:** the outcome, the constraints and the success criteria, in a
   short note that separates what they said from what you assume. Invite correction, and fold the
   answer in before treating it as the brief.
3. **Carry that understanding into the design,** and check every feature and technical choice
   against it.

When the request already gives the purpose and the constraints, reflect them back rather than asking
again.

**Classify before your first question,** and say the classification out loud so the person can
override it:

- **Spike:** a feasibility question ("can we…", "is it possible…") whose output is an answer, not
  code anyone keeps. Present the question and the probe in two or three sentences, get a nod,
  investigate as cheaply as correctness allows, and report a recommendation. Anything built stays
  labelled throwaway. **A spike ends here:** no issue, no folder, no plan, no PR. Its dossier stays
  a draft, which the person who opened it may delete on the Omni page.
- **Bounded:** a well-scoped change to a flow that already exists in this repository, one you can
  read. Explore, ask the few questions that matter (one at a time), present a short design in chat
  (the approach, what it touches, how it is tested), and **stop until you hear an explicit yes**.
- **Architectural:** a new project or subsystem, or a change to how components fit together or to an
  interface others depend on. Explore; ask questions one at a time (multiple choice when you can),
  about purpose, constraints and success criteria; propose two or three approaches with their
  trade-offs, leading with the one you recommend and why; then present the design in sections
  scaled to their complexity (architecture, components, data flow, error handling, testing), asking
  after each one whether it looks right.

In doubt between two paths, take the heavier one. The ratchet is one-way: complexity found mid-way
upgrades the path (stop, say so, step up); nothing downgrades. An idea that holds several independent
subsystems is flagged at once and split into PRDs; brainstorm the first one only.

Design for isolation: small units with one purpose each, a well-defined interface, and internals
that can change without breaking their users. In an existing codebase, follow its patterns and
include only the improvements this work needs. Cut every feature the brief does not need.

**The gate.** A reply approves the stage it was shown, nothing later. Bounded: the chat design is
approved. Architectural: the design is approved section by section, then the written spec (step 4)
is reviewed before `/omni:plan` runs.

## 2. Open the PRD issue

The PRD's number is its issue's number, and it names the inbox folder, so the issue comes first.

1. The folder is `<nnnn>-<topic>`: the number zero-padded to four digits, and a short kebab-case
   `<topic>`. It sits in the `inbox` folder under `paths.delivery`; `<folder>` below is its repository path. `<feature branch>` is
   `branches.feature` with `{topic}` filled; `<phase-0 branch>` is `branches.phase0` with it.
2. Before adding `labels.prd`, check it exists (`gh label list --search "<name>" --json name`) and
   follow `/omni:pr`'s **Labels** rules for a missing one.
3. `gh issue create --title "PRD: <title>" --label "<labels.prd>" --body-file <file>`, with the
   pointer body below, signed (**Signing**). The spec is the file; the issue only points at it,
   because two copies of a long document drift. The issue is still required: it is the PRD's answer
   channel, and the feature PR closes it.

```markdown
**Spec:** `<folder>/spec.md` · **Plan:** `<folder>/plan.md` · **Before/after:** `<folder>/before-after.html`

<One paragraph: what this PRD makes true, and for whom. Everything else is in the spec.>

## Handoff

- Next command: `/omni:yolo <n>`, once the phase-0 PR is merged
- Branch: `<feature branch>`
- Scenarios: `<file>`, … (only when `acceptance.enabled`; "none — no observable behaviour" when there are none)
- Before/after: `<folder>/before-after.html`

<the line `omni sign footer` prints>
```

The `Before/after:` line is a repository path, never a URL.

## 3. Cut the feature branch

Work in a worktree, and never commit on the default branch:

```bash
git fetch <remote>
git worktree add -b <feature branch> <worktrees>/<topic> <remote>/<repo.defaultBranch>
```

Every file in steps 4 to 6 is written in this worktree, inside the PRD's inbox folder.

## 4. Write the spec

`spec.md` in the folder, with exactly this front matter and the prose under it:

```markdown
---
prd: <n>
title: <PRD title>
blocked-by: none
spec: file
---

## Problem

## Solution

## Decisions

## User stories

## Scope

## Test seams

## Risks

## Acceptance criteria
```

- `blocked-by` is **declared, never inferred**: a list of PRD numbers the person named
  (`[3]`), or `none`.
- When `paths.knowledge` holds a knowledge folder, an optional `areas: [<domain>, …]` names the
  domain folders the PRD bears on. No other field: the plan is always the sibling `plan.md`, and
  `omni check inbox` refuses a `status`, `branch`, `value`, `priority` or `plan` field by name.
- **Acceptance criteria** are what `/omni:plan` turns into each slice's "done when", so each one is
  a condition someone can observe. When `acceptance.enabled`, every scenario from step 6 is copied
  here verbatim, in a gherkin block under the path of its file; a scenario with no harness yet is
  written the same way and marked "no harness — ordinary tests". A scenario edited later is edited
  in both places, in the same push.
- **Test seams** and **Acceptance criteria** follow `omni kb show testing`: how this repository
  tests, at which levels, and what a test must never do.
- **Risks** names what merging this PRD would publish, and how that is rolled back: read
  `omni kb show releasing`.
- Words come from `paths.glossary` when it is set, and from the files in `paths.context`.

**Self-review,** before anyone reads it: no placeholder or "TBD", no two sections contradicting each
other, a scope one plan can carry, and no requirement readable two ways (pick one and say it). Fix
inline. **Architectural:** ask the person to review the written spec, make the changes they ask for,
and go on only once they approve it.

## 5. The before/after page

`before-after.html` in the folder, always, because `omni phase0` requires one:

- A change with a **screen:** two mockups side by side, the screen today and the screen after.
- An **API or agent behaviour:** the exchange today and after (request and response, or user turn
  and agent turn), or a flow diagram.
- **Nothing visible** (docs, config, a guard): a short page stating what changes and what stays the
  same, today beside after.

The page is self-contained: inline CSS and inline SVG, no base64 raster image, and at most
`limits.beforeAfterMaxBytes` bytes, which `omni check inbox` enforces. Load the `artifact-design`
skill for the design when your session has it, then write the file. **Never publish it as a claude.ai
artifact:** an artifact is private to its author, so the people the spec is for could not open it. A
file in the repository is versioned, diffable, and reviewed in the phase-0 PR.

## 6. Acceptance scenarios

Only when `acceptance.enabled` is true, and only for behaviour a browser (or the configured harness,
`acceptance.run`) can observe.

1. **Words first.** Every noun and verb exists in `paths.glossary` when it is set. When the area has
   not defined its verbs, add them to the glossary now, in the same commit. Never invent vocabulary
   in a scenario.
2. **Write** each scenario file under `acceptance.dir`, its name ending in `acceptance.pendingSuffix`:
   declarative, one behaviour per scenario, under about eight steps, no HTTP verbs, no status codes,
   no UI mechanics. The suffix keeps the suite green while the steps do not exist; `/omni:do-work`
   drops it once a slice gives the scenario its steps.

Behaviour with no harness is described only in the spec's acceptance criteria, and `/omni:do-work`
turns it into ordinary tests.

## 7. Commit, check, push

In the worktree: commit the folder (and any glossary change and scenario file) as
`docs(prd): <topic>`, ending with the co-author trailer your session requires, then the
`omni sign trailer` line. Then:

```bash
node .omni-loop/bin/omni.mjs check inbox
node .omni-loop/bin/omni.mjs prd <n>        # state inbox, and the folder's files listed
```

Fix until `omni check inbox` is green, then `git push -u <remote> <feature branch>`.

Then follow `/omni:dossier-push <n>` from this worktree: the draft becomes PRD n's dossier, and the
spec and the before/after page go up as its first versions. Whatever it prints, carry on to step 8.

## 8. Plan it

Follow `/omni:plan <n>` from inside the feature worktree, while the design is fresh, so that
delivery only executes. Its step 2 finds the feature branch already checked out here: use this
worktree rather than adding a second one. It writes `plan.md`, grades it with `omni plan check`,
pushes it, sends it to the PRD's dossier through `/omni:dossier-push`, and opens the draft feature
PR.

`/omni:plan` may return `needs clarification`: a plan is never written on a guess. Stop there, and
say what the spec must answer (it has already asked on the issue). There is no phase-0 PR and no
`/omni:yolo` line until it is answered.

## 9. The phase-0 PR

The design is approved, the spec written and the plan computed, and not one line of source exists
yet. That is what a person can review cheaply, so this is where a brainstorm ends.

1. Cut the phase-0 branch from today's default branch and take the files from the feature branch,
   so both copies are byte-identical and merging the default branch into the feature branch later
   reconciles nothing:

   ```bash
   git fetch <remote>
   git worktree add -b <phase-0 branch> <worktrees>/<topic>-phase-0 <remote>/<repo.defaultBranch>
   cd <worktrees>/<topic>-phase-0
   git checkout <remote>/<feature branch> -- <folder> <each scenario file> <the glossary, when step 6 changed it>
   ```

2. Commit as `docs(phase-0): <topic>`, with the co-author trailer, then the `omni sign trailer`
   line: `omni phase0` refuses a commit without it.
3. Prove it is a phase-0 PR before opening it:

   ```bash
   node .omni-loop/bin/omni.mjs phase0 <n>
   ```

   It must print `ok`: docs-only, carrying the spec, the plan and the before/after, and every commit
   signed. `not ok` names what is missing, which source file slipped in, or which commit lacks the
   signature's trailer; fix the branch and rerun. Never leave it red.
4. `git push -u <remote> <phase-0 branch>`, then follow `/omni:dossier-push <n>` from this
   worktree: a file that changed since the last push becomes a new version of it, and an unchanged
   one adds nothing. Whatever it prints, carry on.
5. Open the phase-0 PR through `/omni:pr`'s lifecycle: base `repo.defaultBranch`, head the
   phase-0 branch, a Conventional Commits title (`docs(<scope>): <PRD title>`), `labels.phase0`
   subject to **Labels**, and a body that starts with `prLinks.phase0` filled (it refers to the
   PRD; the feature PR is the one that closes it), followed by Summary, Verified (the `omni phase0`
   and `omni check inbox` lines), Risk and rollback, and Reviewer focus, and ending with the
   `omni sign footer` line.

**A person reviews and merges it.** Never merge it yourself, and never mark the feature PR ready.

## 10. Hand off

Report the PRD issue, the feature PR, the phase-0 PR, the waves `omni plan check` printed, and every
check that ran or did not. Then always end the reply with three blocks, in this order, written for
someone who knows nothing about the loop and just does what it says, one step at a time. Fill every
placeholder with a real path, number or link.

**1. The PRD's folder,** in a code block so the tree lines up: its path, `<folder>/` (the
repository path step 2 named, which is the `dir` that `omni prd <n>` printed), then each file that
command lists, with a few words each. When `acceptance.enabled`, list each scenario file, by its
path, under the tree.

```text
PRD <n>'s folder: on the phase-0 PR now, on <repo.defaultBranch> once it merges

  <folder>/
  ├── spec.md            what changes, and why
  ├── plan.md            how it gets built, slice by slice
  └── before-after.html  today beside after
```

**2. Where it is,** in a code block: the seven stages of the loop on one line, a marker under PRD and
one under inbox, then one plain line per stage.

```text
Where it is

  idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro
            ▲        ▲
            │        └─ merging the phase-0 PR moves it here
            └─ you are here

  idea      talked through, nothing written
  PRD       spec, plan and before/after written, in the phase-0 PR
  inbox     phase-0 PR merged: approved, ready to build
  building  a first sub-PR merged: the agents build it in waves
  outbox    feature PR ready: what the agents decided alone waits for you
  shipped   feature PR merged: the change is on <repo.defaultBranch>
  retro     a retro PR tells how the delivery went
```

The markers never move: "you are here" is always under PRD, because a brainstorm always ends with
its phase-0 PR open, and "merging the phase-0 PR moves it here" is always under inbox.

**3. What is next?** Three short numbered steps, then the command alone on the reply's last line.
Step 1 links the phase-0 PR, and its second line, in brackets, always gives the PRD's page. Run
`node .omni-loop/bin/omni.mjs dossier link <n>`: exit `0` prints the page's link on one line, which
is `<dossier link>` below. Anything else (`none`, `off`, `no sign-in (omni signin)`, `unreachable`,
`refused (<status>)`, or exit `2` from a kit without the verb) means it has no page to show: the
bracketed line is then `(PRD <n> has no page yet: https://github.com/<owner>/<repo>/issues/<n>)`.
It never stops the hand-off.

```markdown
**What is next?**

1. Review the PRD: https://github.com/<owner>/<repo>/pull/<phase-0 PR>
   (spec, plan and before/after side by side: <dossier link>)
2. Merge that PR. → PRD <n> moves into the inbox.
3. Once it's merged, type /clear (or open a new terminal), then run:

/omni:yolo <n>
```

The command is the very last line of the reply, alone on it, and never a planning command: planning
already ran in step 8. Everything the next session needs is in the repository and on GitHub, so
clearing the session loses nothing.

## Scaling

- **Spike:** step 1 only.
- **Bounded:** every step; the design is the short one approved in chat, the spec is short, and the
  page may be the plain today-and-after one.
- **Architectural:** every step, with the sectioned design and the written-spec review.

## Guardrails

- Nothing is built before the design is approved, and no source file enters the phase-0 PR.
- One idea, one PRD, one feature branch. Related small asks go in the same PRD now, not in its plan
  later.
- Never merge, never add `labels.outboxGo`, never create a label unless `labels.autoCreate` is true.
