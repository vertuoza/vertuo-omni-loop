---
name: brainstorm
description: Turns an idea into an approved design, then into a PRD the loop can build — the PRD issue, the spec, the before/after page and the pending acceptance scenarios in the PRD's inbox folder, its plan through /omni:plan, and a docs-only phase-0 PR a person reviews and merges before any code is written — or, when the repository's phase 0 is on the server, no phase-0 PR and an approval on the PRD's page. Use before any change someone wants made. With --concept <n> <area>, starts from one area of a concept /omni:think-big left in the inbox. Writes no code, merges nothing. Ends with the /omni:yolo line. Triggers on "brainstorm", "I have an idea", "let's design this", "turn this into a PRD", "/omni:brainstorm".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-brainstorming/SKILL.md (with the superpowers brainstorming steps written in) — changes in kit/porting/plugin--brainstorm.md -->

# Brainstorm: an idea into a PRD the loop can build

An idea in; out come an approved design, the PRD issue, its inbox folder (spec, before/after page,
pending acceptance scenarios), its plan and draft feature PR, and a docs-only **phase-0 PR**. It ends
at a review gate, not at delivery: a person merges the phase-0 PR, then runs `/omni:yolo`. In a
repository whose phase 0 is on the server, the PRD is born there (◆): no phase-0 PR is opened, and
`/omni:yolo` asks its approvers with `omni wait approval` and waits until one approves it on its
PRD page (**Where its phase 0 is approved**).

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Inputs

| input | example | notes |
|---|---|---|
| the idea | `/omni:brainstorm 'a line or a paragraph'` | what someone wants changed, in their words |
| `--concept <n> <area>` | `/omni:brainstorm --concept 712 day-view` | in place of the idea: one area of a concept that `/omni:think-big` recorded and a person merged into the inbox, read as **From a concept** says |

| `--rework <n>` | `/omni:brainstorm --rework 822` | in place of the idea: rework PRD `<n>`'s spec and before/after from what its personas said, as **Rework** says; the User voice tab on the PRD's page copies this line |

`<n>` everywhere below is the PRD's number. Under `--concept`, the concept's own number is written
`<concept>` and the area's id `<area>`. Without `--concept`, nothing that names it applies, and the
brainstorm runs as it always has.

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

**Where its phase 0 is approved.** Each repository's phase-0 flag is kept on the Omni page, never in
the config: `pr`, a phase-0 PR a person merges, as always; or `server`, an approval on the PRD's
page. Read it now, once, with `node .omni-loop/bin/omni.mjs approval flag`, and keep it for every
step below. It prints one line:

- `phase 0: server`: the PRD is born on the server (◆). Say `phase 0: server · approved on the
  PRD's page`.
- `phase 0: pr`: the PRD is born in the repository (◇), and the brainstorm runs as it always has.
- `phase 0: pr · the flag could not be read: <why>` (exit 1: no Omni page, no sign-in, no answer
  within 5 seconds, or the page refused): print the line as is. The run carries on as ◇.

The birthplace is for life: a flag flipped later changes no PRD that already exists. Under `server`,
step 4 writes it in the spec, step 7's first dossier push records it on the dossier, step 9 opens no
phase-0 PR and step 10 hands off to the PRD's page. Everything else runs as written.

**The design flag.** Read it once: `node .omni-loop/bin/omni.mjs config design.enabled`, and keep
what it prints for step 5 (and **Rework**, which writes the page the same way). Anything but `true`
(or a failure) means design craft is off here: step 5 reads no design form, and the page is drawn
as it always has been.

With `--concept`, read the concept next, as **From a concept** says. Each of its three stops ends
the skill there, before the dossier opens and before any question.

Then read the business this repository serves: `node .omni-loop/bin/omni.mjs business show --json`.
Keep its confirmed claims, under their ids (`size#2`), and its `personas`, each under the id
`persona:<name>`: they are **The voice**. A `state` other than `ok` (`none`, `no-sign-in`,
`unreachable`, `refused`) is said to the person in one line, and the run carries on with whatever
personas the read still listed. Without personas, the brainstorm runs as today: no objection, no
overrule, no gap question and no `voice.json`.

With `--rework <n>`, go to **Rework** now: nothing below it runs, and no dossier opens.

Then, before your first question, follow `/omni:dossier-open` with one line of the idea (with
`--concept`, the area's name and its brief): it opens a draft dossier for it on the Omni page,
linked to this Claude session, and prints its link as "follow along at …", which the person can
send to whoever the idea is for. Whatever it prints, carry on to step 1: a draft that did not open
stops nothing.

## From a concept

Only with `--concept <n> <area>`. A concept enters the inbox when a person merges its pull request,
so it is read from the default branch, never from a branch of its own:

```bash
git fetch <remote>
git ls-tree --name-only <remote>/<repo.defaultBranch> <paths.delivery>/inbox/concepts/
```

Its folder is the entry named `<nnnn>-<slug>`, `<nnnn>` being `<concept>` zero-padded to four
digits; `<concept folder>` below is that folder's repository path. Read the concept from the same
ref, with `git show <remote>/<repo.defaultBranch>:<concept folder>/concept.md`. Its **Areas** table,
`| id | area | brief | PRD |`, lists the areas in build order, the wedge first.

Stop with the line alone, and write nothing, when:

| the concept | the line |
|---|---|
| has no folder there, or no `concept.md` in it | `concept #<concept> is not in the inbox yet: merge its PR first` |
| has no row whose `id` is `<area>` | `concept #<concept> has no area <area>: its areas are <id>, <id>, …`, every id in the table's order |
| has that row's `PRD` cell filled | `area <area> of concept #<concept> already has its PRD: #<prd>`, the number the cell holds |

Otherwise keep, for the steps below:

- **the area:** its row, its name and its brief;
- **the vision:** the concept's **The vision** section, and its `kind`;
- **the verdict:** its **Why this one** section, the dissent included;
- **the area's screens:** read the vision tour from the same ref, with
  `git show <remote>/<repo.defaultBranch>:<concept folder>/vision.html`, and take the screens of it
  that the area covers: those its brief or **The vision** names for it, or, when neither names any,
  those that show what its brief describes.

## 1. Brainstorm the design

This step is a conversation with the person who has the idea. Everything they decide here is asked,
never assumed; nothing below it starts before the design is approved. Read-only exploration of the
repository is allowed throughout.

**With `--concept`, the concept speaks first.** Before your first question, write back as your
understanding the area's brief, the vision and the verdict (**From a concept**), and name the screens
of `vision.html` you took as the area's. Keep what the concept settled apart from what you assume,
and invite correction. Then ask only what the concept leaves open. Classify the work all the same,
as below; every step after this one runs as it does without `--concept`, save where it says
otherwise.

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
  (the approach, what it touches, how it is tested), let the voice object (**The voice**), and
  **stop until you hear an explicit yes**.
- **Architectural:** a new project or subsystem, or a change to how components fit together or to an
  interface others depend on. Explore; ask questions one at a time (multiple choice when you can),
  about purpose, constraints and success criteria; propose two or three approaches with their
  trade-offs, leading with the one you recommend and why; then present the design in sections
  scaled to their complexity (architecture, components, data flow, error handling, testing), asking
  after each one whether it looks right; after the first section, before asking, the voice objects
  (**The voice**).

In doubt between two paths, take the heavier one. The ratchet is one-way: complexity found mid-way
upgrades the path (stop, say so, step up); nothing downgrades. An idea that holds several independent
subsystems is flagged at once and split into PRDs; brainstorm the first one only. Without
`--concept`, also offer, in the same message, the `/omni:think-big '<line>'` line, `<line>` being the
idea in one line, to explore the whole idea as a concept first: when the person takes it, the
brainstorm ends there, as a spike does.

Design for isolation: small units with one purpose each, a well-defined interface, and internals
that can change without breaking their users. In an existing codebase, follow its patterns and
include only the improvements this work needs. Cut every feature the brief does not need.

**The gate.** A reply approves the stage it was shown, nothing later. Bounded: the chat design is
approved. Architectural: the design is approved section by section, then the written spec (step 4)
is reviewed before `/omni:plan` runs.

**The proof question** (PRD 798), once the design is approved and only when
`node .omni-loop/bin/omni.mjs config proof.url` prints something other than `null`, ask one
question, yes or no: *"Record a proof video once it ships?"*. A yes writes `proof: video` in the spec's
front matter (step 4), and `/omni:yolo` then follows `/omni:prove` once the feature PR is ready. A no,
or `proof.url` unset, writes nothing and asks nothing.

**The e2e question** (PRD 1275), right after the proof question and only when
`node .omni-loop/bin/omni.mjs config e2e` prints `enabled` as true, ask one question, yes or no:
*"Validate with e2e once it ships?"*. A yes writes `e2e: validate` in the spec's front matter
(step 4), and `/omni:yolo` then follows `/omni:validate-e2e` once the feature PR is ready. A no, or
e2e off, asks nothing and writes nothing.

**The product question** (PRD 1364), right after the e2e question: run
`node .omni-loop/bin/omni.mjs product which`, which prints the products this repository is in, one per
line, or `none`. Only when it prints more than one product, ask one question: *"Which product is this
PRD for?"*, its options each product it printed, by name, and **No product**. Keep the answer for
step 7's first push; it is the PRD's product, so its approvers, claims and personas are that
product's. With one product or `none`, ask nothing: the Omni page gives the PRD that one product, or
none, by itself. When the command exits 1 (no Omni page, no sign-in, the page unreachable or its
refusal), print its line as is and ask nothing: the PRD is born with whatever the page decides, and
its page's Product picker changes it until it is approved.

## The voice

Only when step 0's read listed personas. They speak for the people the product is sold to: all of
them up to five, or the five that differ most in stance and trade. Every line the voice says cites a
`persona:<name>` or a claim id; it never states a business fact the claims do not hold.

**The objection.** When the design is shown (the Bounded design in chat, or the Architectural
design's first section), just before the approval question, the persona the design fits worst
**objects once**: one or two first-person sentences, each citing a `persona:<name>` or a claim id. A
sentence without a citation is dropped, never shown, and the objection stays silent when the design
fits every persona. It is settled one of four ways: `accepted` (the design changed to meet it),
`saved-as-claim` or `just-this-run` (an overrule, below), or `none` (the person approved without
answering it). The spec's **Decisions** record the objection and how it was settled.

**Overrule.** When the person answers the objection with a fact about the business ("we're going
after 50-person firms now"), ask through AskUserQuestion "Is that new about the business?", with two
choices:

- **Save as a claim:** store it as a proposed claim, which a member confirms later on Settings ›
  Business, `<kind>` being the one of region, offering, size, trade or rival the fact is about:

  ```bash
  node .omni-loop/bin/omni.mjs business claim add --kind <kind> --value <value> --state proposed --ref 'brainstorm · <run>'
  ```

- **Just this run:** nothing is stored; the personas accept the fact until the session ends.

**One gap question.** At most once per run, when the design leans on a kind (region, offering, size,
trade, rival) with no confirmed claim, ask one question through AskUserQuestion (ask mode carries it
to the Omni page): its choices are the Business page's pick list for that kind, the values that fit
the design first, then **Not sure**; Other is the person's own words. Store the answer confirmed:

```bash
node .omni-loop/bin/omni.mjs business claim add --kind <kind> --value <answer> --state confirmed --ref 'brainstorm · <run>'
```

**Not sure** stores nothing, and the run carries on. `<run>` in both receipts is the idea in a few
words (with `--concept`, `concept #<concept> <area>`). Both writes exit 0 whatever happens: a "claim
skipped" line is said to the person, and the run carries on.

**The record: `voice.json`,** beside the spec in the PRD's folder, one round per stage: round
`design` when the design is shown (keep it until step 4 writes the file), round `spec` once the spec
is written (step 4), each with its date, every speaking persona's score from 1 to 5 and cited
reaction, the round's objection and how it was settled (left empty when the voice stayed silent),
and the fit line. The
kit's schema holds the fields: `node .omni-loop/bin/omni.mjs check inbox` (step 7) refuses a file
that does not read, naming the round and the field.

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

The `Before/after:` line is a repository path, never a URL. For a ◆ PRD, the Next command line
ends `: it runs omni wait approval <n> and waits for the approval on its PRD page` in place of
`, once the phase-0 PR is merged`: it has no phase-0 PR.

With `--concept`, the paragraph names where the PRD comes from, as `concept #<concept>, area <area>`:
GitHub links the concept's issue, which stays open as the concept's thread and so lists each PRD
made from it.

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
  domain folders the PRD bears on.
- `proof: video` only when the person said yes to the proof question (step 1); its only value is
  `video`, and `omni check inbox` refuses any other.
- `e2e: validate` only when the person said yes to the e2e question (step 1); its only value is
  `validate`, and `omni check inbox` refuses any other.
- `phase0: server` only for a ◆ PRD (step 0 read the flag as `server`), written under `spec: file`;
  its only value is `server`, and `omni check inbox` refuses any other by name. A ◇ PRD leaves it
  out. It tells every gate, offline, that this PRD is approved on the server, and the server reads it
  on the dossier's first push to set the dossier's birthplace. Never add or remove it afterwards.
  No other field: the plan is always the sibling `plan.md`, and
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

**The voice,** when step 0 listed personas: write `voice.json` beside the spec, with the round
`design` kept from step 1 and the round `spec`, the personas judging the spec as written
(**The voice**).

## 5. The before/after page

`before-after.html` in the folder, always, because `omni phase0` requires one:

- A change with a **screen:** two mockups side by side, the screen today and the screen after.
  With the design flag on, read `node .omni-loop/bin/omni.mjs kb show design` first (and the file a
  pointer section names), and build the "after" from the product's own tokens and components as
  its `system` section names them: their colours, type scale, spacing and component shapes, read
  from those files, never a palette or a style of your own. What its `deliberate` section says the
  product does on purpose holds on the "after" too, over any rule of craft. A `[hole]` is filled
  from what the "today" screen and its neighbours already use, never invented; say under the
  mockup which section was a hole. The "after" changes only what the approved design changes.
- An **API or agent behaviour:** the exchange today and after (request and response, or user turn
  and agent turn), or a flow diagram.
- **Nothing visible** (docs, config, a guard): a short page stating what changes and what stays the
  same, today beside after.

With `--concept`, the "after" starts from the area's screens in `vision.html` (**From a concept**),
each redrawn as a static mockup: the tour's look and layout, never its script or its motion, and
changed only where the approved design moved away from the concept. The "before" is today, as
always.

The page is self-contained: inline CSS and inline SVG, no base64 raster image, and at most
`limits.beforeAfterMaxBytes` bytes, which `omni check inbox` enforces. Load the `artifact-design`
skill for the design when your session has it, then write the file. **Never publish it as a claude.ai
artifact:** an artifact is private to its author, so the people the spec is for could not open it. A
file in the repository is versioned, diffable, and reviewed in the phase-0 PR (◆: on the PRD's page,
where the dossier push sends it).

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

With `--concept`, first fill the area's `PRD` cell with `#<n>` in `<concept folder>/concept.md` in
this worktree, and change nothing else in that file: the Areas table becomes the map of which area
became which PRD. The file goes in the same commit as the PRD's folder. The cell must still be
empty there; when another brainstorm filled it since step 0, stop before committing and say so,
naming that PRD.

In the worktree: commit the folder (its `voice.json` included, when step 4 wrote one, and any
glossary change and scenario file, and with `--concept` the concept's `concept.md`) as
`docs(prd): <topic>`, ending with the co-author trailer your session
requires, then the `omni sign trailer` line. Then:

```bash
node .omni-loop/bin/omni.mjs check inbox
node .omni-loop/bin/omni.mjs prd <n>        # state: inbox (◆: state: prd, waiting for approval), and the folder's files listed
```

Fix until `omni check inbox` is green, then `git push -u <remote> <feature branch>`. For a ◆ PRD,
`omni prd` also prints `birthplace: server` and its `approval:` lines. Nobody has approved it yet, so
its `state:` is not `inbox` (`prd`, waiting for approval, or another state while the dossier does not
exist yet): that is expected here, never a failure. A ◆ PRD whose `omni prd` prints no
`birthplace: server` line has lost its `phase0: server`: fix the spec.

Then follow `/omni:dossier-push <n>` from this worktree: the draft becomes PRD n's dossier, and the
spec and the before/after page go up as its first versions. For a ◆ PRD, this first push is what
makes the dossier's birthplace `server`: the server reads it from the spec's `phase0: server`.
When step 1's product question picked a product, this first push carries it: run it as
`node .omni-loop/bin/omni.mjs dossier push <n> --product '<name>'` and read what it prints as
`/omni:dossier-push` says; **No product**, or no question asked, sends none. Only this first push
names a product: every later push leaves it out. Whatever it prints, carry on.

With `--concept`, then follow `/omni:dossier-push <concept> --kind concept` from this worktree too:
the concept's page gets the `concept.md` whose area now names PRD n, so its Areas tab links that
area to its PRD at once. Whatever it prints, carry on to step 8: a push that was skipped or refused
stops nothing.

## 8. Plan it

Follow `/omni:plan <n>` from inside the feature worktree, while the design is fresh, so that
delivery only executes. Its step 2 finds the feature branch already checked out here: use this
worktree rather than adding a second one. It writes `plan.md`, grades it with `omni plan check`,
pushes it, sends it to the PRD's dossier through `/omni:dossier-push`, and opens the draft feature
PR.

`/omni:plan` may return `needs clarification`: a plan is never written on a guess. Stop there, and
say what the spec must answer (it has already asked on the issue). There is no phase-0 PR and no
`/omni:yolo` line until it is answered.

For a ◆ PRD, `/omni:plan` runs while the PRD waits for approval: the plan is part of what is
approved, so its gate takes `state: prd` with `birthplace: server` here, as it says.

## 9. The phase-0 PR

The design is approved, the spec written and the plan computed, and not one line of source exists
yet. That is what a person can review cheaply, so this is where a brainstorm ends.

**A ◆ PRD opens no phase-0 PR.** When step 0 read the flag as `server`, skip this step whole: no
phase-0 branch, no `docs(phase-0)` commit, no `omni phase0`, no PR. The spec, the plan, the
before/after and the voice are already on its dossier (step 7's push and `/omni:plan`'s), and the PRD
page is where a workspace member reviews and approves them: go to step 10. Never approve it yourself.

1. Cut the phase-0 branch from today's default branch and take the files from the feature branch,
   so both copies are byte-identical and merging the default branch into the feature branch later
   reconciles nothing:

   ```bash
   git fetch <remote>
   git worktree add -b <phase-0 branch> <worktrees>/<topic>-phase-0 <remote>/<repo.defaultBranch>
   cd <worktrees>/<topic>-phase-0
   git checkout <remote>/<feature branch> -- <folder> <each scenario file> <the glossary, when step 6 changed it> <the concept's concept.md, with --concept>
   ```

   With `--concept`, that last path is `<concept folder>/concept.md`, its area's `PRD` cell filled
   in step 7: it sits under the delivery folder, so `omni phase0` counts it as a document, and the
   concept's Areas table changes on the default branch when the PRD enters the inbox.

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
check that ran or did not. With `--concept`, also say that the phase-0 PR fills the `PRD` cell of
area `<area>` in concept #<concept>. Then always end the reply with three blocks, in this order,
written for someone who knows nothing about the loop and just does what it says, one step at a
time. Fill every placeholder with a real path, number or link.

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
its phase-0 PR open (◆: waiting for approval), and "merging the phase-0 PR moves it here" is always
under inbox.

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

**A ◆ PRD's hand-off.** It has no phase-0 PR, so the report names none, and the three blocks say
"`/omni:yolo <n>` asks its approvers with `omni wait approval <n>` and waits; one approves it on its
page". The folder's first line reads
`PRD <n>'s folder: on <feature branch> now, on <repo.defaultBranch> once the feature PR merges`.
**Where it is** keeps the stages line and its markers, but the inbox marker reads
`└─ approving it on its PRD page moves it here`, and two stage lines change:

```text
  PRD       spec, plan and before/after written, on its PRD page, waiting for approval
  inbox     approved on its PRD page: ready to build
```

**What is next?** gives the PRD's page, `<dossier link>` as above (with the same bracketed issue
fallback when it has none):

```markdown
**What is next?**

1. Review the PRD on its page: <dossier link>
   (spec, plan and before/after side by side, every version kept)
2. Its approvers approve it there. → PRD <n> moves into the inbox.
   `omni wait approval <n>` asks them by phone and email, and waits for the approval.
3. Type /clear (or open a new terminal), then run the line below: it runs
   `omni wait approval <n>` and starts wave 1 the moment the PRD is approved.

/omni:yolo <n>
```

The command is the very last line of the reply, alone on it, and never a planning command: planning
already ran in step 8. Everything the next session needs is in the repository and on GitHub, so
clearing the session loses nothing.

## Rework

Only with `--rework <n>`: the PRD's personas said something, and the spec and the before/after are
rewritten to answer it, before anyone builds. `<folder>`, `<topic>`, `<feature branch>` and
`<phase-0 branch>` are PRD n's, as step 2 names them (`omni prd <n>` prints the folder).

1. **Refuse once building has started.** Run
   `gh pr list --base <feature branch> --state merged --json number --limit 1`. When it lists a
   pull request, a sub-PR has merged: stop with the line alone,
   `PRD <n> is being built: /omni:yolo-fix <n> owns its changes now`, and write nothing.
2. **Read the latest round.** `git fetch <remote>`, check out the feature branch in a worktree
   (`git worktree add -B <feature branch> <worktrees>/<topic> <remote>/<feature branch>`), and read
   `<folder>/voice.json`. No file, or no round in it: stop with the line alone,
   `PRD <n> has no voice yet: nothing to rework from`.
3. **Rewrite** the spec and the before/after page to answer the latest round's objection and its
   lowest scores, the way steps 4 and 5 write them, and add the change to the spec's **Decisions**.
   The overrule and the gap question hold as in **The voice**.
4. **Ask the personas again** as round `rework-<k>`, `<k>` one more than the last rework round (1
   for the first), appended to `voice.json`.
5. **Commit** the three files as `docs(prd): rework <topic> from the voice`, signed (**Signing**),
   run `node .omni-loop/bin/omni.mjs check inbox` until it is green, push the feature branch, then
   follow `/omni:dossier-push <n>` from this worktree: each file that changed becomes a new version.
6. **The review.** When the phase-0 PR is open, take the three files onto its branch as step 9
   item 1 does, commit as `docs(phase-0): rework <topic>`, signed, and prove it with
   `node .omni-loop/bin/omni.mjs phase0 <n>` before pushing. When it has merged, cut a new branch
   from the default branch, `branches.phase0` with `{topic}` = `<topic>-rework-<k>`, take the files
   the same way, prove it the same way, push it, and open it as a docs-only PR through `/omni:pr`,
   as step 9 opens the phase-0 PR. A ◆ PRD (its spec says `phase0: server`) has no phase-0 PR:
   skip this item; the push of item 5 put the new versions on its page, and an approval given
   before them now reads drifted until a member approves again there.
7. **Hand off:** the new round's scores beside the last ones, the PR updated or opened, the dossier
   link, and, as the reply's last line, `/omni:yolo <n>` once that PR is merged (◆: once it is
   approved again on its page).

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
- Never approve a ◆ PRD: a workspace member does, on its page. Never open a phase-0 PR for one,
  and never change a PRD's birthplace once its spec is written.
- With `--concept`, never change a concept's files beyond the area's `PRD` cell: the concept is read,
  not rewritten.
- With `--rework`, never rework a PRD once a sub-PR of it has merged: `/omni:yolo-fix` owns its
  changes then. Never let a persona say what no claim or persona holds.
