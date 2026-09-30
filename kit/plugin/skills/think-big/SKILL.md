---
name: think-big
description: Explores a vast idea before /omni:brainstorm with a studio of agents that talk to each other — judges its scale and kind (a tweak gets the /omni:visual-fix line, a feature is offered /omni:brainstorm or a lite run), fuels the studio with today's product and world-class references, then runs rounds of rendered concepts, six to eight storyboard cards then clickable prototypes, that a panel of a Visionary, a Craft critic, a Skeptic, a Value critic and real users debates by name while the person reacts at every round and crowns one. Records the crowned concept, its vision tour, every board, the debate and an area map of PRD-sized areas in the inbox, proves it with omni concept, and opens one concept PR a person merges. Writes no code, merges nothing. Ends with the /omni:brainstorm --concept line of the first area. Triggers on "think big", "explore this vast idea", "a brand new identity for the app", "go wide first", "/omni:think-big".
---

# Think big: a vast idea into a concept

A studio before the loop, for product and design people, run before anyone commits to building.
`/omni:brainstorm` converges: it cuts every feature the brief does not need and turns an idea into
one PRD. This skill goes wide first. It checks the idea is vast, fuels itself with today's product
and world-class references, then runs a **studio** of role agents that talk to each other over
rounds of rendered concepts: wide first, then deeper, while the person reacts at every round and
always picks. It ends with a **concept** in the inbox: the crowned vision, its clickable vision
tour, every board and the debate, and an **area map** of PRD-sized areas in build order. It ends at
a review gate: **a person merges** the concept PR, then each area becomes a PRD through
`/omni:brainstorm --concept <n> <area>`, the wedge first.

In order: **start** (step 0); the **gate** on scale and kind (1); the **fuel** (2); **round 1**, go
wide (3); **rounds 2 and on**, deepen (4); the **crown** (5); the **record** (6); **hand off** (7).
**The studio** and **Boards** hold at every round.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Input

| input | example | what it is |
|---|---|---|
| a brief | `/omni:think-big 'an agenda in our app for every employee'` | the idea in the person's words, a line or a paragraph; step 6 opens its issue |
| an issue number | `/omni:think-big 712` | an issue that already states the brief; step 6 uses it as it is |

With neither, say that this skill takes the brief, a line or a paragraph, or an issue number, and
stop. With a number, read it first: `gh issue view <n> --comments`.

## Step 0

**Start.** Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
Omni Loop kit is not installed in this repository. Keep the JSON; later steps read `repo.*`,
`branches.concept`, `worktrees`, `paths.delivery`, `paths.knowledge`, `labels.concept`,
`labels.autoCreate` and `limits.beforeAfterMaxBytes` from it. `<remote>` below is `repo.remote`.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`.
Its rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

Then, before your first question, follow `/omni:dossier-open` with one line of the brief: it opens a
draft dossier for it on the Omni page, linked to this Claude session, and prints its link as
"follow along at …". Whatever it prints, carry on: a draft that did not open stops nothing. The
draft stays a draft; no step below pushes to it.

Then say, once and plainly, that a full run is token-heavy (about 8 to 12 agents over 3 to 4 turns
a round), that the person can stop after any round, and that nothing is written in the repository
or on GitHub before step 6.

Make one folder for this run in the session's scratchpad directory, `<scratch>` below
(`think-big-<slug>`, `<slug>` a short kebab-case name of the brief). Every file of steps 2 to 5 is
written there, and nowhere else.

## The studio

Read it before step 3; it holds at every round.

| Role | Lives | Job | Its question |
|---|---|---|---|
| **Concept artist**, 3 or 4 | round 1 | Go wide, each from its own lens (**The kind shapes the studio**); write two concepts and render their cards | — |
| **Prototyper**, 2 or 3 | one per survivor, rounds 2 and on | Render one survivor's direction as a clickable prototype | — |
| **Visionary** | the whole run | Push the wow; refuse the safe version | Would someone screenshot this and send it to a colleague? |
| **Craft** | the whole run | Interaction, motion, density, the empty and error states | Is every pixel and every transition deliberate? |
| **Skeptic** | the whole run | What breaks, what it costs, the smallest proof | What must be true for this to work? |
| **Value** | the whole run | Who it matters to, what moves, why now | What changes for the business if this ships? |
| **User**, 1 or 2 | the whole run | A real person drawn from the brief and the product's knowledge | Would I use this at 7am on Monday, on site, on my phone? |
| **Moderator** | the main session: you | Run the turns, relay, keep the transcript, write the verdict; never votes | — |

The **panel** is the Visionary, Craft, Skeptic, Value and the users.

### Role cards

Each agent is spawned with its card, filled, and with nothing of this skill but its card. Every card
ends with the same three rules: read the fuel sheet `<scratch>/fuel.md` and the brief first; write
only under `<scratch>`, never in the repository; spawn no agent of your own.

- **Concept artist, lens `<lens>`.** "You are a concept artist of a product studio, and your lens is
  `<lens>`. Write two concepts for the brief that differ in direction, not in shade. For each: a
  name, its **wow moment** in one sentence (the moment a user would tell a colleague about), the
  **axis** it differs on, and one **storyboard card**: its one key screen, as a self-contained HTML
  fragment in `<scratch>/r1/<your id>-<1|2>.html`. Start from the product's real look where the
  concept allows. Inline CSS and inline SVG only: no script, stylesheet, font or image from the
  network, no base64 raster image."
- **Prototyper.** "You render one direction the panel agreed on as a **clickable, multi-screen
  prototype**, three to five screens with motion and micro-interactions, in one self-contained HTML
  page at `<scratch>/r<k>/<letter>.html`: inline CSS, inline SVG and inline script only, nothing from
  the network, no base64 raster image, at most `<limits.beforeAfterMaxBytes>` bytes. The direction,
  the survivor it grew from and the person's note on it are below."
- **Visionary, Craft, Skeptic, Value.** "You are the `<role>` of a studio panel. Your job: `<its
  job>`. Your question, asked of every concept: `<its question>`. Each turn, for every standing
  concept, post: a reaction in two or three sentences; one *yes, and…* remix; your scores (below);
  a one-line stance. When the others' posts are relayed to you, answer them by name: build on,
  challenge, or change your mind and say so. Keep your positions from turn to turn unless you say
  why they moved."
- **User `<name>`.** The panelist card above, as a real person: who they are, their day and the
  device in their hand, drawn from the brief and from the product's knowledge, never invented past
  them; the personas the kind sets (**The kind shapes the studio**). Their question: "Would I use
  this at 7am on Monday, on site, on my phone?", said in their own situation.

The **Skeptic's** card adds the dial: in round 1 it may not veto on cost, only ask what must be true.

### How they talk

**They talk to each other.** The panel is spawned **once**, in a single message, one agent per role,
each with its card, through the session's agent tool. Each is then **continued** turn after turn
through the session's agent-messaging tool (such as SendMessage), so it keeps its role, its memory
and its earlier positions. Where the session cannot continue an agent, each turn spawns it again
with its card and the transcript so far: the same debate, at a higher cost; say so once when it
happens. Artists and prototypers are spawned for their round, in parallel, in one message. Every
agent writes only under `<scratch>`, never in the repository, and spawns no agent of its own.

The moderator keeps the whole transcript in `<scratch>/transcript.md`: every post, by round, turn
and role, dissent included. Step 6 commits it as `debate.md`.

### One debate

Between the person's reactions and the next board, one debate, in three moves:

1. **Open.** In parallel, each panelist reacts to every standing concept, proposes a *yes, and…*
   remix of it, and scores it.
2. **Cross-talk.** The moderator relays every post to everyone. Each panelist
   answers the others by name (builds on, challenges, changes its mind) and may revise its remix.
   One or two such turns, stopping early when nobody moves.
3. **Converge.** The moderator turns the remixes into one direction per survivor; the prototypers
   render the next board from it.

### The "go crazy" dial

In round 1 the Skeptic cannot veto on cost: it may only ask what must be true. Feasibility is scored
from round 2.

### Verdicts

Each concept is scored 1 to 5 on *Wow*, *User value*, *Craft*, *Fit* and *Feasibility* (not scored in
round 1), with a one-line stance from each panelist. **Dissent is kept, never averaged away:** a
strong minority view shows on the board beside the consensus. The moderator writes the verdict and
never votes.

### No two concepts the same

Each concept names its wow moment and the axis it differs on. The moderator sends back, before the
board is drawn, two concepts that differ in shade and not in direction; the artist rewrites one.

### The kind shapes the studio

| Kind | Concept artists' lenses | What the boards show | User personas |
|---|---|---|---|
| product | 10×, steal from another industry, delight, contrarian | storyboard cards, then clickable prototypes | the brief's end users |
| identity | evolution, revolution, heritage, unexpected | brand boards (type, colour, motion, voice) applied to the product's real screens | customers, and staff who see it daily |
| platform | clean slate, strangler, tooling first, contrarian | the target architecture, the migration paths, and a demo of the experience it unlocks | developers and operators, and the end user who feels the change |

## Boards

Each round's board is one self-contained HTML page, `<scratch>/board-r<k>.html`, k = 1, 2, … in the
order shown. The moderator builds it from the round's cards or prototypes, copied in, never linked.
Per concept: its letter, its name, its wow moment, its axis, the card or the prototype, the panel's
scores, each stance, and the dissent beside the consensus.

Each concept carries four toggles, **keep**, **kill**, **merge** (into another letter) and
**push further**, and a note. The page carries a **copy my reactions** button that builds one line
from them and copies it, such as `keep B E · merge C→E · push D: more playful · kill rest`.

Every page (a board, a card, a prototype or the vision tour) is self-contained: inline CSS, inline
SVG and inline script, no resource loaded from the network (no external script, stylesheet, font,
image or `@import`; a link a person may follow is allowed), no base64 raster image (a `data:image/`
URL that is not SVG), and at most `limits.beforeAfterMaxBytes` bytes. Step 6 commits the boards as
they were shown, and `omni concept` checks each rule.

Open each board in the person's browser when the session can, and give its path either way. Then
ask **one question** per round through the session's question tool (AskUserQuestion; ask mode
carries it to the Omni page when it is on). Its answer is one of:

- the **reactions line**, from the button, or the same in the person's words;
- **another round**, with a note;
- **crown `<letter>`**, from round 2 on;
- **stop**.

Keep each answer as it was given: step 6 writes it at the top of that round's board. The skill
never kills, merges or crowns a concept the person did not. A concept the reactions do not name
stands, and the next debate asks what to do with it in its converge.

## 1. Gate

Before any concept, judge the idea's **scale** and **kind**, and say both out loud, in one short
note, so the person can override them.

**Scale.**

- *Vast*: it spans the whole product or many of its screens, changes how the product looks, speaks
  or is built everywhere, or gives a whole population of users a new experience; it would take more
  than one PRD. It carries on.
- *Feature*: one PRD would carry it. Say so, plainly, and ask one question with two answers: run
  `/omni:brainstorm '<line>'` now (give the line, and stop), or a **lite** run: the same studio and
  rounds, ending in a concept with one area.
- *Tweak*: a colour, a spacing, a label on a screen that exists. Give the
  `/omni:visual-fix '<line>'` line, and stop. Nothing is written.

In doubt between feature and vast, take vast. The ratchet is one-way, as in `/omni:brainstorm`:
scale found mid-way upgrades a lite run to a vast one (say so); nothing downgrades a vast one.

**Kind.** *product* (a new experience, such as an agenda for every employee), *identity* (how the
product looks, speaks and moves, such as a new brand identity) or *platform* (how it is built, such
as a rewrite in another language). The kind sets the lenses, what the boards show and who the users
are (**The kind shapes the studio**).

**Brief.** Write back your understanding: the outcome, who it is for, what success looks like,
separating what the person said from what you assume. Invite correction, and ask one question at a
time until the brief holds. It is the brief every agent reads, and the first section of
`concept.md`.

## 2. Fuel

Write one **fuel sheet**, `<scratch>/fuel.md`, that every agent of the studio reads. Read only;
nothing in the repository changes.

- **Today's product.** Its screens and where their look comes from (design tokens, stylesheets,
  components); its knowledge, when `paths.knowledge` holds one (principles, rules, invariants; a
  **proposed** entry describes the product but is no law); and, for a platform idea,
  `node .omni-loop/bin/omni.mjs kb show architecture`. Concepts are a measured leap from here, and
  prototypes start from the real look where the concept allows.
- **World-class references,** when the session can search the web: patterns from other products and
  other industries (consumer apps, games, professional tools), each with its link and what to take
  from it. **No reference is cited that was not looked at.** When the session cannot search, say
  so, cite none, and let the studio work from the product and its own knowledge.

## 3. Round 1, go wide

1. In one message, spawn the panel (**How they talk**) and three or four concept artists, each with
   its own lens for the kind.
2. Each artist writes two concepts and their cards: six to eight in all. Letter them A, B, … in the
   order they come back, and send back any pair that differs in shade only
   (**No two concepts the same**).
3. The panel opens its debate on them (**One debate**), with the "go crazy" dial on: no veto on cost,
   no Feasibility score.
4. Write `board-r1.html` (**Boards**), open it, give its path, and ask the one question.

A stop ends the run here: go to step 7.

## 4. Rounds 2 and on, deepen

1. Relay the person's answer to the panel. Its debate (**One debate**), Feasibility now scored,
   remixes the survivors into **one direction each**; a merge the person asked for becomes one
   direction.
2. Spawn one **prototyper** per survivor, two or three in all, in one message. Each renders its
   direction as a clickable, multi-screen prototype with motion and micro-interactions. Two directions
   that come back the same in shade go back once, as in round 1.
3. Write `board-r<k>.html`, open it, give its path, and ask the one question.

"Another round" repeats this step from the note; there is no limit but the person's. A crown goes to
step 5; a stop goes to step 7.

## 5. Crown

The person crowns one concept; the studio never does. For it:

1. **The vision tour,** `<scratch>/vision.html`: a short clickable walk through its key moments, five
   to eight screens or steps, in the product's real look where the concept allows. For an identity
   idea, in the new look; for a platform idea, through the target architecture, the migration path
   and the experience it unlocks. Rendered by the crowned concept's prototyper, continued, under the
   page rules of **Boards**.
2. **The verdict:** the panel's last scores and stances on it, and the dissent, written by the
   moderator (**Verdicts**).
3. **The area map:** the panel proposes two to six areas (one, for a lite run), each small enough for
   one PRD, each with a kebab-case `id`, a name, a one-line brief and the vision tour's screens it
   covers, **in build order, the wedge first**: the area that proves the concept soonest, on which
   the others build.

Show the vision tour (open it, give its path) and the area map as a table, and ask for edits in
**one reply**: the person renames, merges, drops, adds or reorders areas before anything is written.
Fold the reply in; ask again only when it leaves the map outside two to six areas (one, for lite) or
two areas with the same id.

## 6. Record

The first step that writes in the repository or on GitHub. `<n>` below is the concept issue's
number, `<nnnn>` is `<n>` zero-padded to four digits, and `<slug>` is a short kebab-case name of the
crowned concept.

1. **Issue.**
   - **With a brief:** check `labels.concept` exists (`gh label list --search "<labels.concept>"
     --json name`) and follow `/omni:pr`'s **Labels** rules for a missing one. Then open the issue,
     signed (**Signing**):

     ```bash
     gh issue create --title "Concept: <title>" --label "<labels.concept>" --body-file <file>
     ```

     ```markdown
     <the brief, as step 1 settled it>

     A concept: `/omni:think-big` explored this idea with a studio of agents, and the person crowned
     one direction. Its folder, with the vision tour, every board, the debate and the areas in build
     order, enters the inbox through one pull request a person merges. Each area then becomes a PRD
     through `/omni:brainstorm --concept <n> <area>`, the first area first. This issue stays open as
     the concept's thread: each area's PRD names it, and a person closes it when they choose.

     <the line `omni sign footer` prints>
     ```

   - **With a number:** use that issue as it is. When it does not carry `labels.concept`, add it
     (`gh issue edit <n> --add-label "<labels.concept>"`), subject to the same **Labels** rules.

2. **Branch.** Cut a worktree on `branches.concept`, with `{topic}` = `<n>-<slug>`, from the default
   branch. Every change below is made in it; never commit on `repo.defaultBranch`.

   ```bash
   git fetch <remote>
   git worktree add -b <concept branch> <worktrees>/<n>-<slug> <remote>/<repo.defaultBranch>
   ```

3. **Folder.** `<paths.delivery>/inbox/concepts/<nnnn>-<slug>/`, which the kit keeps apart from every
   PRD folder. Write in it exactly these files, and nothing else:

   ```text
   <paths.delivery>/inbox/concepts/<nnnn>-<slug>/
   ├── concept.md       the concept: what /omni:brainstorm reads
   ├── vision.html      the crowned concept's clickable vision tour
   ├── board-r1.html    round 1 as shown, with the person's reactions line
   ├── board-r2.html    …, one board-r<k>.html per round shown
   └── debate.md        the studio's turns, round by round and by role, dissent included
   ```

   - **The boards** are copied from `<scratch>` as they were shown, one line added at the top of each
     page's body: `<p data-omni-reactions>…</p>`, holding the person's answer to that round, as
     given.
   - **`vision.html`** is step 5's tour, as shown.
   - **`debate.md`** is the transcript: every post by round, turn and role, the dissent included.
   - **`concept.md`**, exactly this shape:

     ```markdown
     ---
     concept: <n>
     title: <title>
     kind: <product | identity | platform>
     scale: <vast | lite>
     ---

     ## The brief

     ## The vision

     ## Why this one

     ## Killed and why

     ## Fuel

     ## Areas

     | id | area | brief | PRD |
     |---|---|---|---|
     | <wedge id> | <name> | <one line> | |
     | <area id> | <name> | <one line> | |
     ```

     The front matter holds exactly those four fields: `concept` is the issue's number, `scale` is
     `vast`, or `lite` for a lite run. The six sections are all there, in that order: **The brief**
     (what was asked, and what was assumed), **The vision** (the crowned concept and its wow
     moments), **Why this one** (the verdict: the scores, each role's stance, the dissent), **Killed
     and why** (one line per concept that did not survive, so killed ideas stay findable), **Fuel**
     (the product facts read, and the references looked at, with their links) and **Areas**. The
     Areas table lists the areas in build order, **its first row the wedge**; each `id` kebab-case
     and unique; two to six rows for a vast concept, one for a lite one; every `PRD` cell empty, for
     `/omni:brainstorm` to fill.

4. **Commit** the folder as `docs(concept): <slug>`, with the session's co-author trailer, then the
   `omni sign trailer` line (**Signing**).

5. **Prove it:** `node .omni-loop/bin/omni.mjs concept <n>`. Run it until it prints `ok`:

   | exit | what you do |
   |---|---|
   | `0` | `ok`: carry on. |
   | `1` | `not ok`, one line per failed check: fix each (a second folder, a missing or stray file, a gap in the rounds, a `concept.md` the parser refuses, a page too big, a raster image, a page loading from the network, a file changed outside the folder, an unsigned commit), commit, and rerun. |
   | `2` | The kit is not installed here, or its config does not read: say so and stop. |

6. **Push** the concept branch: `git push -u <remote> <concept branch>`.

7. **Open the PR through `/omni:pr`**, as a standalone PR: base `repo.defaultBranch`, label
   `labels.concept` (subject to its **Labels** rules), title `docs(concept): <title>`, and this body,
   signed (**Signing**):

   ```markdown
   Refs #<n>

   ## The concept

   <the vision, in one paragraph>. Kind: <kind>; scale: <vast | lite>.

   ## Areas

   <the Areas table of concept.md, as it is, the wedge first>

   ## Verified

   - `omni concept <n>`: ok
   - boards shown: `board-r1.html`<, `board-r2.html` …>; vision tour: `vision.html`, beside
     `concept.md` in `<paths.delivery>/inbox/concepts/<nnnn>-<slug>/`

   ## Risk and rollback

   Documents only, under the inbox's concepts folder, which no reader of PRD folders reads. Roll back
   by reverting this PR.

   <the line `omni sign footer` prints>
   ```

   Paths in the body are repository paths, never URLs. `/omni:pr` watches it until it is green or
   stuck.

**A person merges it;** only then is the concept in the inbox, where `/omni:brainstorm --concept`
reads it. Never merge it yourself.

## 7. Hand off

**Stopped early.** At the gate, the hand-off is its line (`/omni:visual-fix '<line>'`, or
`/omni:brainstorm '<line>'`) and nothing else. After a round, it is the scratchpad paths of the
boards shown, a line saying nothing was written in the repository or on GitHub and that a new run
starts over, and the `/omni:think-big '<the brief>'` line to start again.

**Recorded.** Report the concept's issue, its PR, the kind and scale, the rounds shown, and every
check that ran or did not (`omni concept <n>`, whether the references were looked up or the session
could not search). Then always end the reply with two blocks, in this order, written for someone
who knows nothing about the loop and just does what it says. Fill every placeholder with a real
path, number, id or link.

**1. The concept's folder,** in a code block so the tree lines up: its path, `<folder>/` (the
repository path of step 6), then each file, with a few words each.

```text
Concept <n>'s folder: on the concept PR now, in the inbox once it merges

  <folder>/
  ├── concept.md       the concept, and its areas in build order
  ├── vision.html      the crowned concept's vision tour: open it in a browser
  ├── board-r1.html    round 1 as you saw it, with your reactions
  ├── board-r2.html    …
  └── debate.md        what the studio said, round by round
```

**2. What is next?** Three short numbered steps, then the wedge's command alone on the reply's last
line. Step 1 links the concept PR, and its second line, in brackets, gives the concept's issue,
`https://github.com/<repo.slug>/issues/<n>`. Step 3 lists one `/omni:brainstorm --concept` line per
area, in build order, the wedge first.

```markdown
**What is next?**

1. Review the concept: https://github.com/<owner>/<repo>/pull/<concept PR>
   (its thread, where each area's PRD will be named: https://github.com/<owner>/<repo>/issues/<n>)
2. Merge that PR. → concept <n> moves into the inbox.
3. Once it's merged, type /clear (or open a new terminal), then brainstorm one area at a time, in
   this order, the wedge first:
   - /omni:brainstorm --concept <n> <wedge id>
   - /omni:brainstorm --concept <n> <area id>
   - …

/omni:brainstorm --concept <n> <wedge id>
```

The wedge's command is the very last line of the reply, alone on it. Everything the next session
needs is in the repository and on GitHub, so clearing the session loses nothing.

## Never

- **Never merge.** A person merges the concept PR; the skill stops at the hand-off.
- **Never crown, kill or merge a concept for the person.** The studio argues, scores and recommends;
  the person picks, at every round.
- Never write in the repository or on GitHub before step 6: a run stopped earlier leaves only its
  scratchpad, and the draft dossier of step 0.
- Never let an agent of the studio write in the repository or spawn an agent of its own.
- Never cite a reference that was not looked at, and never report a screen as seen that was not.
- Never commit on `repo.defaultBranch`, and never change a board after it was shown, but for the
  reactions line at its top.
- Never open a PRD, a spec, a plan, a phase-0 PR, a feature branch or an outbox item for a concept:
  each area's `/omni:brainstorm --concept` does that for its PRD.
