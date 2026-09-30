---
prd: 686
title: /omni:think-big, a studio of agents that explores vast concepts before /omni:brainstorm
blocked-by: none
spec: file
---

# /omni:think-big, a studio of agents that explores vast concepts before /omni:brainstorm

**Date:** 2026-09-29 · **PRD:** #686 · **Follows:** PRD 7 (the loop's skills), PRD 541
(`/omni:visual-fix`, rounds of rendered variations a person picks from) · **Touches:** the kit only:
a new skill `kit/plugin/skills/think-big/`, an additive change to
`kit/plugin/skills/brainstorm/SKILL.md`, a new verb `kit/bin/commands/concept.mjs` over a new
`kit/lib/concept/`, the layout (`kit/lib/layout.mjs`), the config schema (`kit/lib/config.mjs`), the
label list (`kit/lib/init/labels.mjs`), the help entries (`kit/lib/help/entries.mjs`), the guide
(`docs/guide/use-cases.md`, `docs/guide/loop.md`), the delivery README and the rebuilt bundle. No
migration, and no change to the galaxy app's code, the GitHub App or the game.

**First of two.** This PRD is the skill, its record and its hand-off into `/omni:brainstorm`. A page
for concepts on the Omni page (a concept dossier, the debate and the boards readable by the whole
workspace, team votes) needs a new dossier kind and a migration, and is its own PRD, brainstormed
after this one.

## Problem

The feedback on what the loop ships is that the UX, the UI and the features are not innovative
enough: they work, and nobody says "wow". The loop has no step where that could happen.
`/omni:brainstorm` is built to converge: it asks about purpose, cuts every feature the brief does
not need, and turns an idea into one PRD a plan can carry. That is right for building, and wrong for
imagining. Nothing in the loop goes wide first, shows people something concrete to react to, or
argues about which direction is the bold one before the scope is cut.

Vast ideas have it worst. "Give this application a brand new identity", "rewrite it in TypeScript",
"an agenda in our app for every employee": each spans the whole product and holds several PRDs.
Today they enter `/omni:brainstorm` as one line, get flagged as too big, and are split into PRDs
before anyone has seen what the whole could be.

## Solution

A new skill, `/omni:think-big`, for product and design people, run before anyone commits to
building. It checks that the idea is vast, fuels itself with today's product and world-class
references, then runs a **studio** of role agents that talk to each other and iterate over rounds of
rendered concepts: wide first, then deeper, while the person reacts at every round and always picks.
It ends with a **concept** in the inbox: the crowned vision, its clickable vision tour, every board
and the debate, and an **area map** of PRD-sized areas in build order. Each area then becomes a PRD
through `/omni:brainstorm --concept <n> <area>`.

```
think-big ──▶ concept (inbox) ──▶ area 1, the wedge ─▶ /omni:brainstorm --concept <n> <area> ─▶ PRD
                               ├─▶ area 2           ─▶ /omni:brainstorm --concept <n> <area> ─▶ PRD
                               └─▶ …
```

### The flow

`/omni:think-big '<the brief, a line or a paragraph>'`, or `/omni:think-big <n>` for an issue that
already states the brief.

0. **Start.** `omni config`, then `omni kb show briefing` (its rules bind every step), then
   `/omni:dossier-open` with one line of the brief, as `/omni:brainstorm` does. A draft that did not
   open stops nothing. The skill then says, once, that a full run is token-heavy (about 8 to 12
   agents over 3 to 4 turns a round) and that the person can stop after any round.
1. **Gate.** Before any concept, the skill judges the idea's **scale** and **kind** and says both out
   loud, so the person can override them:
   - **Scale.** *Vast*: it spans the whole product or many of its screens, changes how the product
     looks, speaks or is built everywhere, or gives a whole population of users a new experience;
     it would take more than one PRD. *Feature*: one PRD would carry it. *Tweak*: a colour, a
     spacing, a label on a screen that exists.
     - A tweak gets the `/omni:visual-fix '<line>'` line, and the skill stops.
     - A feature is said to be one, plainly, and the person picks, in one question: the
       `/omni:brainstorm '<line>'` line now (the skill stops), or a **lite** run: the same studio
       and rounds, ending in a concept with one area.
     - A vast idea carries on. In doubt between feature and vast, the skill takes vast; the ratchet
       is one-way, as in `/omni:brainstorm`.
   - **Kind.** *Product* (a new experience, such as the agenda), *identity* (how the product looks,
     speaks and moves, such as a new brand identity) or *platform* (how it is built, such as a
     TypeScript rewrite). The kind sets what the boards show and who the user personas are
     (**The studio**, below).
   - **Brief.** The skill writes back its understanding (the outcome, who it is for, what success
     looks like), separating what the person said from what it assumes, and asks one question at a
     time until the brief holds.
2. **Fuel.** One **fuel sheet** every agent of the studio reads, written to the session's
   scratchpad:
   - *Today's product*, read-only: its screens and where their look comes from (design tokens,
     stylesheets, components), its knowledge (`paths.knowledge`: principles, rules, invariants) and,
     for a platform idea, `omni kb show architecture`. Concepts are a measured leap from here, and
     prototypes start from the real look where the concept allows.
   - *World-class references*, when the session can search the web: patterns from other products and
     other industries (consumer apps, games, professional tools), each with its link and what to take
     from it. When the session cannot search, the skill says so and the studio works from the
     product and its own knowledge. **No reference is cited that was not looked at.**
3. **Round 1, go wide.** Three or four **concept artists** each write two concepts, six to eight in
   all, and render each as a **storyboard card**: one key screen and its one **wow moment**, the
   moment a user would tell a colleague about, in a sentence. The panel opens its debate on them
   (**The studio**). The skill writes the round's **board** (**Boards**, below), opens it in the
   person's browser when the session can, gives its path either way, and asks one question.
4. **Rounds 2 and on, deepen.** The person's reactions go to the panel, whose debate remixes the
   survivors into one direction each; one **prototyper** per survivor renders it as a **clickable,
   multi-screen prototype** with motion and micro-interactions, two or three in all. A new board,
   one question. "Another round" repeats this step; there is no limit but the person's.
5. **Crown.** The person crowns one concept; the studio never does. For it:
   - the **vision tour**, a short clickable walk through its key moments, five to eight screens or
     steps, in the product's real look where the concept allows (in the new look, for an identity
     idea; through the target architecture, the migration path and the experience it unlocks, for a
     platform idea);
   - the panel's **verdict** on it (**The studio**);
   - the **area map**: the panel proposes two to six areas (one, for a lite run), each small enough
     for one PRD, with an id, a name, a one-line brief and the vision tour's screens it covers, **in
     build order, the wedge first**. The person renames, merges, drops, adds or reorders areas in
     one reply before anything is written.
6. **Record.** The concept's issue, branch, folder, check and pull request (**The record**, below).
7. **Hand off.** The concept's folder, where it stands, and what is next: merge the concept PR, then
   `/clear`, then one `/omni:brainstorm --concept <n> <area>` line per area in build order, the
   wedge's line alone on the reply's last line.

The person can stop after any round. Nothing is then written in the repository or on GitHub; the
hand-off gives the scratchpad paths of the boards shown.

### The studio

| Role | Lives | Job | Its question |
|---|---|---|---|
| Concept artists, 3 or 4 | round 1 | Go wide, each from its own lens (below); write two concepts and render their cards | — |
| Prototypers, 2 or 3 | one per survivor, rounds 2 and on | Render one survivor's direction as a clickable prototype | — |
| **Visionary** | the whole run | Push the wow; refuse the safe version | Would someone screenshot this and send it to a colleague? |
| **Craft** | the whole run | Interaction, motion, density, the empty and error states | Is every pixel and every transition deliberate? |
| **Skeptic** | the whole run | What breaks, what it costs, the smallest proof | What must be true for this to work? |
| **Value** | the whole run | Who it matters to, what moves, why now | What changes for the business if this ships? |
| **User**, 1 or 2 | the whole run | Real people drawn from the brief and the product's knowledge | Would I use this at 7am on Monday, on site, on my phone? |
| Moderator | the main session | Run the turns, relay, keep the transcript, write the verdict; never votes | — |

**They talk to each other.** The panel (Visionary, Craft, Skeptic, Value and the users) is spawned
once, in a single message, each with its role card, and each is **continued** turn after turn
through the session's agent-messaging tool, so it keeps its role, its memory and its earlier
positions. Where a session cannot continue an agent, each turn spawns it again with its role card
and the transcript so far: the same debate, at a higher cost. Subagents write only to the
scratchpad, never to the repository, and spawn no subagents of their own.

**One debate**, between the person's reactions and the next board:

1. **Open.** In parallel, each panelist reacts to every standing concept, proposes a *yes, and…*
   remix of it, and scores it.
2. **Cross-talk.** The moderator relays every post to everyone. Each panelist answers the others by
   name (builds on, challenges, changes its mind) and may revise its remix. One or two such turns,
   stopping early when nobody moves.
3. **Converge.** The moderator turns the remixes into one direction per survivor; the prototypers
   render the next board from it.

**The "go crazy" dial.** In round 1 the Skeptic cannot veto on cost: it may only ask what must be
true. Feasibility is scored from round 2.

**Verdicts.** Each concept is scored 1 to 5 on *Wow*, *User value*, *Craft*, *Fit* and
*Feasibility* (not scored in round 1), with a one-line stance from each panelist. **Dissent is kept,
never averaged away**: a strong minority view shows on the board beside the consensus.

**No two concepts the same.** Each concept names its wow moment and the axis it differs on; the
moderator sends back two concepts that differ in shade, not in direction.

**The kind shapes the studio:**

| Kind | Concept artists' lenses | What the boards show | User personas |
|---|---|---|---|
| product | 10×, steal from another industry, delight, contrarian | storyboard cards, then clickable prototypes | the brief's end users |
| identity | evolution, revolution, heritage, unexpected | brand boards (type, colour, motion, voice) applied to the product's real screens | customers, and staff who see it daily |
| platform | clean slate, strangler, tooling first, contrarian | the target architecture, the migration paths, and a demo of the experience it unlocks | developers and operators, and the end user who feels the change |

### Boards

Each round's board is one self-contained HTML page in the scratchpad, `board-r<k>.html`, k = 1, 2, …
in the order shown. Per concept: its letter, name, wow moment, axis, the card or the prototype, the
panel's scores, each stance and the dissent. Each card carries **keep**, **kill**, **merge** and
**push further** toggles and a note, and the page a **copy my reactions** button that builds one
line, such as `keep B E · merge C→E · push D: more playful · kill rest`.

The skill asks **one question** per round through the session's question tool (ask mode carries it
to the Omni page): the answer is that reactions line, "another round", a crown, or stop. The skill
never kills, merges or crowns a concept the person did not.

Every page (board or vision tour) is self-contained: inline CSS, inline SVG and inline script, no
resource loaded from the network (no external script, stylesheet, font, image or `@import`; a link a
person may follow is allowed), no base64 raster image, and at most `limits.beforeAfterMaxBytes`
bytes.

### The record

- **Issue.** `Concept: <title>`, labelled `labels.concept`, signed, whose body is the brief and one
  paragraph saying what a concept is and what comes next. With `/omni:think-big <n>`, that issue is
  used and gains the label. It stays open as the concept's thread: each area's PRD names it, and a
  person closes it when they choose.
- **Branch.** A worktree on `branches.concept` with `{topic}` = `<n>-<slug>`, cut from the default
  branch.
- **Folder.** `<paths.delivery>/inbox/concepts/<nnnn>-<slug>/`, `<nnnn>` the issue's number
  zero-padded to four digits. `concepts` is not a `<number>-<topic>` name, so every reader of PRD
  folders (the layout, `omni status`, `omni check inbox`, the board) skips it by construction.

```
<paths.delivery>/inbox/concepts/0712-team-agenda/
├── concept.md       the concept: what /omni:brainstorm reads
├── vision.html      the crowned concept's clickable vision tour
├── board-r1.html    round 1 as shown, with the person's reactions line
├── board-r2.html    …, one per round shown
└── debate.md        the studio's turns, round by round and by role, dissent included
```

Nothing else goes in the folder. A board is committed as it was shown, with one line added at its
top: `<p data-omni-reactions>…</p>`, holding the person's answer to that round.

**`concept.md`:**

```markdown
---
concept: 712
title: One agenda for every employee
kind: product
scale: vast
---

## The brief

## The vision

## Why this one

## Killed and why

## Fuel

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| day-view | The living day view | … | |
| crew-sync | Crew sync | … | |
```

- The front matter holds exactly those four fields: `concept` (the issue's number), `title`, `kind`
  (`product`, `identity` or `platform`) and `scale` (`vast` or `lite`).
- The six sections are all present, in that order: **The brief** (what was asked, and what was
  assumed), **The vision** (the crowned concept and its wow moments), **Why this one** (the verdict:
  scores, each role's stance, the dissent), **Killed and why** (one line per concept that did not
  survive, so killed ideas stay findable), **Fuel** (the product facts read, the references looked
  at, with their links) and **Areas**.
- The **Areas** table lists the areas **in build order: its first row is the wedge**. `id` is
  kebab-case and unique; there are two to six rows for a vast concept, one for a lite one. The
  `PRD` cell is empty until `/omni:brainstorm` fills it with `#<prd>`.

**The check, `omni concept <n>`,** run on the concept branch, mirroring `omni visual <n>`. It prints
`ok` when every check holds, and otherwise `not ok` with one line per failed check:

- exactly one folder `<paths.delivery>/inbox/concepts/<nnnn>-*` exists for `<n>`;
- it holds `concept.md`, `vision.html`, `debate.md` and at least `board-r1.html`, its rounds
  numbered from 1 with no gap, and nothing else;
- `concept.md`'s front matter holds exactly the four fields, with `concept` equal to `<n>` and a
  known `kind` and `scale`; its six sections are present in order; its Areas table has the four
  columns, kebab-case ids with no duplicate, the row count its scale allows, and each `PRD` cell
  empty or `#<number>`;
- every page is at most `limits.beforeAfterMaxBytes` bytes, holds no base64 raster image, and loads
  nothing from the network;
- no file outside that folder changed on the branch since it left the default branch;
- every commit on the branch carries the `omni sign trailer` line, unless signing is off.

It exits `0` on `ok`, `1` on `not ok`, and `2` when the kit is not installed or its config does not
read. It takes `--base <ref>`, defaulting to `<remote>/<defaultBranch>`, as `omni visual` does.

**The gate.** The skill commits the folder as `docs(concept): <slug>`, with the session's co-author
trailer, then the `omni sign trailer` line; runs `omni concept <n>` until it prints `ok`; pushes;
then opens the PR through `/omni:pr`: base the default branch, label `labels.concept`, title
`docs(concept): <title>`, a body starting `Refs #<n>`, then **The concept** (the vision in a
paragraph and the kind), **Areas** (the table), **Verified** (the `omni concept` line) and **Risk and
rollback**, ending with the `omni sign footer` line. **A person merges it**; only then is the concept
in the inbox. The skill never merges.

### The hand-off into `/omni:brainstorm`

`/omni:brainstorm` gains one input, `--concept <n> <area>`. Plain runs do not change.

- **The concept must be in the inbox:** the skill reads `concept.md` from
  `<remote>/<repo.defaultBranch>`. A concept not merged yet stops it: "concept #<n> is not in the
  inbox yet: merge its PR first". An unknown area id stops it, naming the ids there are; an area
  whose `PRD` cell is filled stops it, naming that PRD.
- **Step 1 starts from the concept.** The skill writes back the area's brief, the vision and the
  verdict as its understanding, and asks only what the concept leaves open. It still classifies the
  work, and the rest of the brainstorm runs as it does today.
- **The before/after page's "after"** starts from the area's screens in `vision.html`, drawn as
  static mockups, since a before/after page stays inline CSS and SVG.
- **Both ways linked.** The PRD issue's paragraph names `concept #<n>, area <id>`. The skill fills
  the area's `PRD` cell with `#<prd>` in `concept.md`, in the same commit as the PRD's folder, and
  the phase-0 PR carries that file too: it sits under the delivery folder, so `omni phase0` counts
  it as a document. The Areas table becomes the live map of which area became which PRD.
- **The reverse door.** When a plain brainstorm flags an idea as several independent subsystems (it
  already does), it also offers the `/omni:think-big '<line>'` line, to explore it as a concept
  first.

### The kit pieces

| Piece | What it is |
|---|---|
| `kit/plugin/skills/think-big/SKILL.md` | The skill: the gate, the fuel, the studio and its role cards, the rounds, the crown, the record and the hand-off. It names every label, branch and path through `omni config`. |
| `kit/plugin/skills/brainstorm/SKILL.md` | `--concept <n> <area>`, the `PRD` cell, and the reverse door. |
| `kit/lib/concept/` | The `concept.md` parser (strict front matter, the sections, the Areas table) and the `omni concept` verdict. |
| `omni concept <n>` | The verb, `kit/bin/commands/concept.mjs`, registered with the others. |
| `kit/lib/layout.mjs` | The one place that names `<paths.delivery>/inbox/concepts`. |
| `labels.concept`, `branches.concept` | New config keys, defaults `omni:concept` and `docs/concept-{topic}`. `omni init` creates the label with the others. |
| `/omni:help`, `/docs` | Entries for `/omni:think-big` (group *Start a change*) and `omni concept`; the idea stage's line names `/omni:think-big` beside `/omni:brainstorm`; a row and a section in `docs/guide/use-cases.md`; the skill in `docs/guide/loop.md`'s table. |
| Delivery README | A paragraph on `inbox/concepts/`. |
| `kit/dist/omni.mjs` | Rebuilt. |

## Decisions

- **For product and design people, run before anyone commits to building.** The prototypes and the
  debate are the deliverable; engineering joins at `/omni:brainstorm`.
- **Rounds: wide, react, narrow.** Six to eight concepts first, then two or three deepened, then one
  crowned, with the person reacting at every round.
- **The person always picks.** The studio argues, scores and recommends; it never kills, merges or
  crowns on its own, as `/omni:visual-fix` never picks for the person.
- **A panel of four fixed critics and one or two real users**, over a fixed panel alone, design
  lenses, or a panel the person builds each run.
- **Agents that talk to each other,** spawned once and continued turn after turn, so each keeps its
  role and its memory; re-spawning with the transcript is the fallback, not the design.
- **Fuel from the real product and from the web.** A taste form (a new playbook form of design
  principles and admired products) was considered and not chosen.
- **Rising fidelity:** storyboard cards in round 1, clickable prototypes with motion from round 2, a
  vision tour for the crowned concept.
- **A gate on scale and kind.** Tweaks go to `/omni:visual-fix`; a feature is offered either
  `/omni:brainstorm` or a lite run; vast ideas of all three kinds (product, identity, platform) run,
  the boards adapting to the kind.
- **A concept lives in the inbox, under `inbox/concepts/`,** and enters it through a docs-only PR a
  person merges, as a PRD enters it through its phase-0 PR. The subfolder keeps it out of every
  reader of PRD folders.
- **One concept, many PRDs.** The panel proposes the areas and the person edits them; each area is
  one `/omni:brainstorm --concept <n> <area>`, the wedge first.
- **The Areas table is the link,** filled by each area's brainstorm in its phase-0 PR: no new field
  in a PRD's strictly checked front matter.
- **Areas in build order, the wedge first,** read from the table's row order, with no order column
  to keep in step.
- **Approach A:** the skill orchestrates subagents, and the kit adds one check verb. A packaged
  multi-agent workflow script was not chosen (not every session has the tool), nor a debate run by
  the Omni page (the second PRD).

## User stories

- As a product manager with a vast idea, I type it in a paragraph and within the hour I am reacting
  to six to eight rendered concepts, each with the one moment that would make a user tell a
  colleague, instead of a list of requirements.
- As a designer, I watch a Visionary, a Craft critic, a Skeptic, a Value critic and a real user
  argue over each concept by name, see where they disagree, and push the one I like further.
- As the person who crowns the concept, I click through its vision tour and edit its area map
  before anything is written.
- As a reviewer of the concept PR, I open the vision tour and every board as shown, read the debate
  and why the other concepts were killed, and merge it into the inbox.
- As the person who brainstorms an area later, I start from the concept's brief, vision and verdict
  instead of a blank page, and the concept's Areas table shows which areas already have a PRD.
- As a person whose idea is really one feature, I am told so and choose between `/omni:brainstorm`
  now and a lite run; as a person asking for a colour, I get the `/omni:visual-fix` line.

## Scope

**In:** the `/omni:think-big` skill; the `--concept` input and the reverse door in
`/omni:brainstorm`; `kit/lib/concept/` and the `omni concept` verb with their tests; the layout's
concepts folder; `labels.concept`, `branches.concept` and the label's creation by `omni init`; the
help entries, the guide pages and the delivery README; one live run.

**Out:**

- A page for concepts on the Omni page (a concept dossier kind, the debate and boards readable by
  the workspace, team votes): the second PRD. The draft dossier `/omni:dossier-open` opens at step 0
  stays a draft.
- `omni status` and the board counting or listing concepts.
- Retiring a concept (moving it out of the inbox) once every area has shipped.
- Resuming an interrupted run: its boards stay in the scratchpad, and a new run starts over.
- A playbook form for design taste.

## Test seams

Read with `omni kb show testing`. Kit tests are vitest, beside the code they cover, and use the
fixtures in `kit/test/` for a repository on disk. No test calls GitHub or the network.

- **The parser** (`kit/lib/concept/*.test.mjs`): a valid `concept.md` parses, and each of these is
  refused by name: a missing or unknown front-matter field, `concept` not a number, an unknown
  `kind` or `scale`, a missing or misordered section, an Areas table with a missing column, a
  non-kebab or duplicate id, seven areas or none for `vast`, two for `lite`, a `PRD` cell that is
  neither empty nor `#<number>`.
- **`omni concept <n>`** (`kit/bin/concept.test.mjs`, shaped like `kit/bin/visual.test.mjs`), on a
  fixture repository with a concept branch: `ok` for a signed commit carrying a valid folder;
  `not ok` naming each failure alone: no folder, two folders, each missing file, a gap in the
  rounds, a stray file, an invalid `concept.md`, a page over the size cap, a base64 PNG, a page
  loading a script or stylesheet from the network, a file changed outside the folder, an unsigned
  commit; a link a person may follow and a base64 SVG are allowed; exit `2` outside an installed
  repository.
- **The layout and the readers** (`kit/lib/layout.test.mjs`, the status facts' tests): an inbox
  holding `concepts/0712-x/` names the concepts folder through the layout and adds no PRD to the
  layout's folders, its spec files, `omni status` or `omni check inbox`.
- **Phase 0** (`kit/lib/policy/phase-0.test.mjs`): a phase-0 change set that also edits a concept's
  `concept.md` stays docs-only and `ok`.
- **Config and labels** (`kit/lib/config.test.mjs`, `kit/lib/init/labels.test.mjs`): the two keys'
  defaults and overrides, and the label with a colour and a description.
- **The skills** pass the plugin's guards (`kit/test/plugin.test.mjs`: they parse, name only
  commands the CLI has, sign the loop's work) and `kit/test/no-literals.test.mjs` (no label, branch
  or path spelled out).
- **Help and docs** (`kit/lib/help/entries.test.mjs`, `kit/lib/help/render.test.mjs`,
  `apps/galaxy/src/docs/skills.test.ts`, `apps/galaxy/src/docs/guide.test.ts`): the skill count moves
  from 20 to 21, *Start a change* holds `think-big`, and the command entries hold `concept`.
- **The bundle** (`kit/test/dist.test.mjs`) is current.

The studio's conversation (the gate, the debate, the boards, the crown) has no automated test. It is
proven by a live run on this repository, recorded as `live-run.md` beside the plan, as PRDs 541 and
556 proved their skills.

## Risks

Read with `omni kb show releasing`. Merging publishes a new kit release, `v0.0.N`: the one-line
install's bundle and the plugin the marketplace serves. Repositories take the skill with
`omni update`. Nothing changes for a repository that never runs `/omni:think-big`, apart from one
more label that `omni init` creates.

- **Cost.** A full run spawns many agents. The skill says so at the start, the lite run exists, and
  the person can stop after any round.
- **Continuing agents** is not available in every session: the fallback re-spawns each panelist
  with its transcript, at a higher cost.
- **No web search** in a session means no references; the skill says so and cites none.
- **Inline script in committed pages.** The pages load nothing from the network, which
  `omni concept` checks, and are read by opening the file.
- **`/omni:brainstorm` is the most used skill.** Its change is additive and runs only with
  `--concept`; a plain run reads as it does today.
- **Two areas brainstormed at once** fill neighbouring rows of the same Areas table, so the second
  phase-0 PR can conflict once the first merges. It is resolved like any conflict on a phase-0 PR,
  by merging the default branch in and keeping both cells.
- **The GitHub App.** A concept PR is a standalone docs PR: its head is not phase-0 shaped, so the
  inbox check posts nothing, and it closes no PRD issue, so nothing runs on its merge. The plan
  confirms this against `apps/omni-app` without changing it.
- **Rollback:** revert the feature PR. Concept issues and `inbox/concepts/` folders already created
  stay: plain issues and docs, which no reader of PRD folders reads.

## Acceptance criteria

Acceptance scenarios are off in this repository (`acceptance.enabled` is false): every criterion
becomes ordinary tests or the live run.

1. `omni config` shows `labels.concept`, default `omni:concept`, and `branches.concept`, default
   `docs/concept-{topic}`; `omni init` creates the label.
2. `omni concept <n>` prints `ok` and exits `0` on a concept branch whose one
   `<paths.delivery>/inbox/concepts/<nnnn>-<slug>/` folder holds a valid `concept.md`,
   `vision.html`, `debate.md` and rounds `board-r1.html` on, with every commit signed.
3. `omni concept <n>` prints `not ok` and exits `1`, naming the failure, for each failure the test
   seams list; it exits `2` outside an installed repository.
4. An inbox holding a concepts folder shows no extra PRD in `omni status`, and `omni check inbox`
   stays green.
5. A phase-0 change set that also fills a concept's `PRD` cell is `ok` for `omni phase0`.
6. `kit/plugin/skills/think-big/SKILL.md` exists, carries the gate, the fuel, the studio, the rounds,
   the crown, the record and the hand-off, and passes the plugin's guards and the no-literals guard.
7. `kit/plugin/skills/brainstorm/SKILL.md` takes `--concept <n> <area>`: it refuses a concept not in
   the inbox, an unknown area and an area with a PRD; it fills the area's `PRD` cell in the PRD's
   commit; it offers `/omni:think-big` when an idea holds several subsystems; and it still passes
   the plugin's guards.
8. `/omni:help` lists `/omni:think-big` under *Start a change* and `omni concept` among the commands;
   the use-cases page has a row and a section for it, and the loop page's table lists it.
9. **Live run:** `/omni:think-big` on one real vast brief in this repository states the scale and
   kind, shows a round-1 board of six to eight concepts and at least one deeper round of clickable
   prototypes, runs a debate in which panelists answer each other by name, crowns the person's pick
   with a vision tour and an edited area map, and opens one `omni:concept` PR whose
   `omni concept <n>` prints `ok`. The feature PR links it.
10. **Live gate:** `/omni:think-big` on a feature-sized line says so and offers `/omni:brainstorm`
    or a lite run; on a tweak, it gives the `/omni:visual-fix` line and writes nothing.
11. **Live hand-off:** once a person has merged that concept PR, `/omni:brainstorm --concept <n>
    <wedge>` writes back the wedge's brief and the concept's vision as its understanding before its
    first question, and `/omni:brainstorm --concept <n> nope` stops naming the concept's area ids.
    `live-run.md` records both, or says the concept PR was not merged and they were not run.
