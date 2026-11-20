---
prd: 3107
title: A Commander per Virtual Fleet
blocked-by: none
spec: file
phase0: server
---

## Problem

A Virtual Fleet works while its people are away, and when they come back they have no one to ask.
The Operation room shows the ledger, one row per thing that happened, but a member who wants to know
"what is PRD 2817 waiting for?" reads rows until they find it. The questions waiting on a person are
spread over four places (a runner job's questions, a mission's items, the outbox, the approvals),
each with its own page. And a member who wants to tell the fleet something ("use the old API for
2817", "the design review is tomorrow") has no way to: the only channels are the answers to
questions the fleet asked first.

The fleet also forgets. Each mission starts from its brief; nothing carries what the last mission
learned, decided or got wrong into the next one.

Concept 2800 (Fleet operation room) heard this need from two personas, who wanted the Fleet to open
on what waits on them, and refused the answer it was offered (a standup) because it imitated a
person. Paperclip (an open-source "company of agents", MIT) answers it with a CEO agent people talk
to; it is the inspiration here, never a copy.

## Solution

Each Virtual Fleet gets a **Commander**: a fifth tab on the Fleet page, after Board, holding **one
thread per fleet** that every workspace member sees, like a channel with the fleet.

**Who it is.** The Commander is an agent, never a person. Every reply it writes is signed
`Commander · agent`; it has no first name and no face, and it never speaks or answers in a person's
name (never#10, L-AIACT-1). It is a seat of the fleet, as the Reviewer is.

**The tab.** Under the fleet's header and tabs, a **status line** read from the database, never the
model: the fleet's running, waiting and paused missions (each count a link) and the share of today's
tokens used, with **Notebooks · <n>** at its end. Then two columns: the **thread** and, on the right,
the **Waiting on you** rail. The tab's name carries the count of questions waiting on a person.

**Ask.** The box has two modes, **Ask** | **Message fleet**. In Ask (placeholder `Ask the
Commander`, button **Ask**), a member writes a question in plain words. A first visit shows
`Ask about this fleet.` and three suggested questions: `What waits on me?`, `What happened
overnight?` and one built from the newest stopped PRD (`Why did PRD 2817 stop?`). The app gathers
the fleet's **short-term memory**, read live and never copied (the fleet's running, waiting and
paused missions, the questions waiting on a person, the last 50 events of each running mission, each
compacted to one line, the fleet's runner jobs of the last 24 hours), adds both **notebooks** (the
fleet notebook's last 50 lines that are not deleted) and the thread's last 20 messages, the
Commander's own earlier replies passed back as their linked claims only. While it works, a pending
row says what it reads (`Reading the record · 2 missions · 3 jobs`); at most 3 tool rounds.

**Claims, never free links.** Every record the context holds gets a short reference (`e12` for an
event, `j3` for a job, `p2817` for a PRD, `q4` for a waiting question). The model answers in a
fixed shape, `{ verdict, claims: [{ text, refs: [..] }] }`, and **never writes a link**: the app
keeps a claim only when each of its references was in this turn's context or tool results, and
builds every URL itself. A claim without a valid reference is removed. The reply shows the verdict
in bold, then one row per claim with its source as a chip on the right (hover or tap shows that
record's own line and time), then a footer: `Read <n> events · <time>`, and `<k> sentence(s)
removed: no link.` when some were. When nothing is kept: `I could not find that in the fleet's
record.`, never that all is well.

**Data, never instructions.** Event sentences, pull request titles, notebook lines and members'
messages reach the model inside delimited, escaped data blocks, after the instructions: text in them
is never obeyed. The Commander's tools only read; it sends nothing on its own.

**Answer.** The **Waiting on you** rail holds one **card** per question waiting on a person in this
fleet: a runner job's question, a mission item, an outbox item, an approval. A card is built from
the question's own record, never from what the model wrote, and stays there until answered, whatever
the thread does; a claim about it links to its card. A click on a choice selects it and asks
`Answer as <login>?` with **Confirm** and Cancel; on Confirm, the app checks again that the question
is still open, then sends the choice through the answer route that question already has
(`/api/runners/jobs/[id]/answers`, `/api/missions/items/[item]`, `/api/outbox/answer`), signed by
that member, exactly as if they had answered on its own page. A card then reads `Answered by
<login> · <time> · <choice>`, the same when it was answered on its own page, and `Not sent: try
again.` when the route refused. The Commander never picks a choice and never answers for anyone
(never#2). An answer, once given, is never changed (BR-PRODUCT-12): that is why a card confirms. An
approval card only links to the PRD's page: approving stays there. At zero: `Nothing waits on
you.` The rail works with the Commander off or out of tokens: it needs no model.

**Message the fleet.** In **Message fleet** (placeholder `Agents read this at their next job`,
button **Send to fleet**), the message is stored signed by its author and tagged `To the fleet`,
and a `messaged` event is added to each of the fleet's running missions, linking to it. When a
runner job of that fleet starts, its claim carries the fleet's messages written since that mission's
previous job of the same role, and `omni session start` prints them under `From your people`,
each with its author and time. The message then reads `Read by <role> · job <id>`, linked; until
then `Waiting for next job`; with no running mission, `No mission running: no agent will read
this.` before it is sent. An agent reads a message as it reads an answer: it never overrides a law,
a Never line or the spec; a message that conflicts with them becomes an outbox item. Nothing running
is interrupted.

**Long-term memory: two notebooks.**

- The **mission notebook**, one per mission: while the mission runs, a background job on the app's
  job ledger (ADR-0123) adds at most one batch of lines a day from that day's events: what was done,
  what was decided, what went wrong.
- The **fleet notebook**, one per fleet: when a mission is delivered or stopped, the same job writes
  the few lines that carry to the next mission: lessons, recurring problems, decisions that hold.

Every line is at most 300 characters, carries its date and cites at least one event of the same
fleet; a line with none is refused by the database. The notebook job writes from the same delimited
data blocks, drops a candidate line that reads as an instruction (to an agent, to the Commander or to
a person) and a line that repeats one already there. The notebooks are shown in the tab (a **Notebooks** drawer: the fleet's, then one per
mission), every member reads them, and any member may delete a line (with Undo for 5 seconds): the deletion is
recorded with who did it and when, and the line leaves the Commander's memory. A note never holds a credential, a
log excerpt or a person's words: it says what happened and links to it.

**Costs and refusals.** The Commander's model calls count against the fleet's daily tokens
(`teams.daily_tokens`, PRD 3040); the stable part of the prompt is cached (OpenRouter passes the
provider's prompt caching through) and one message's input is capped at 40,000 tokens. The tab says, in one line, and the rest of the Fleet page keeps
working:

- no model key on the server: `The Commander is off: no model key.`, with a Settings link;
- the fleet's tokens used up: `Tokens used up. Back at <time> UTC.`, in place of the box;
- the model fails or takes more than 30 seconds: `No answer: try again.`, the member's message kept
  in the thread.

The thread is kept 90 days; the decisions it carried stay for good in the tables that already record
them (L-GDPR-4).

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | migration | `20270128090000_fleet_commander.sql` | conventions › A migration stays the newest (after `20270127100000_omni_bug_team.sql`) |
| vertuoza/vertuo-omni-loop | tables | `commander_messages`, `commander_notes` | no written convention: follows `supabase/migrations/20270122093000_missions.sql:183` (`mission_events`, snake_case, named for its owner) |
| vertuoza/vertuo-omni-loop | event kind | `messaged` | no written convention: follows `supabase/migrations/20270127100000_omni_bug_team.sql:239` (kebab-case past tense) |
| vertuoza/vertuo-omni-loop | fleet tab | `commander`, label `Commander` | no written convention: follows `apps/galaxy/src/dashboard/fleet/tabs.ts:5` |
| vertuoza/vertuo-omni-loop | galaxy module | `apps/galaxy/src/virtual-fleets/commander/` (`commander.controller.ts`, `.service.ts`, `.repository.ts`, `.contract.ts`, `CommanderTab.tsx`) | ADR-0095 (client → controller → service → repository); follows `apps/galaxy/src/virtual-fleets/` |
| vertuoza/vertuo-omni-loop | API route | `apps/galaxy/app/api/virtual-fleets/commander/route.ts` (+ `/notes`) | no written convention: follows `apps/galaxy/app/api/virtual-fleets/tokens/` |
| vertuoza/vertuo-omni-loop | App module | `apps/omni-app/src/missions/notebook.ts` (+ `notebook-run.ts`) | no written convention: follows `apps/omni-app/src/missions/milestone.ts` and `milestone-run.ts` (pure step, its run beside it) |
| vertuoza/vertuo-omni-loop | model call | `apps/galaxy/src/virtual-fleets/commander/model.ts`, `COMMANDER_MODEL = 'anthropic/claude-sonnet-5.5'` | no written convention: follows `apps/galaxy/src/ask/classify.ts:53` (`OPENROUTER_URL`, a named model constant, a timeout) |
| vertuoza/vertuo-omni-loop | session block | `From your people` in `omni session start` | no written convention: follows `kit/bin/commands/session.ts` (one titled block per source) |

## Decisions

- **Runs in the app, not on a runner** (the person, design round): replies in seconds, no runner slot.
  Reading the code is out of scope; a later PRD may let the Commander send a runner job for it.
- **Two notebooks, per mission and per fleet** (the person, design round), instead of one notebook.
- **One shared thread per fleet** (the person): every member sees every message, each signed.
- **Messages are read at the agent's next job** (the person), never interrupting one; a person's
  message is never stored in `mission_events`, which holds no person's words
  (`20270122093000_missions.sql:198`): the event links to it.
- **The objection of persona:B-E DEv** (skeptical), at the design: *"In concept 2800 I trusted the
  room because every row is a job id I can debug. A chat that says 'PR 2817 is nearly done' is
  narration."* Settled `accepted`: every sentence about the fleet carries a link, or is dropped.
- **Taken without asking, most reversible first:** the model is `anthropic/claude-sonnet-5.5` through
  the app's own `OPENROUTER_API_KEY` (a constant, changed in one line); 90 days of thread (L-GDPR-4);
  replies are not streamed (a later change); the notebook job runs at most once a day per mission; the
  context is capped at 50 events per running mission and 20 thread messages.
- **A review panel** (the person asked for it, after the first look): a UX/UI designer, a power user
  of Paperclip and Grok-style chats, and an AI engineer reviewed the screens. Adopted: the Waiting on
  you rail, the confirm step and card states, claims as rows with chips, the Ask | Message fleet
  modes, the message receipts, the status line, the first-visit questions, the reading row, claims
  with references instead of free links, cards built from their records, data blocks against prompt
  injection, the notebook's instruction and duplicate screens, prompt caching and the input cap.
  Left for later: mentions of a mission or PRD in the box, unread markers, a third "request changes"
  choice, a daily digest, per-mission threads.
- **Out of scope, for later PRDs:** Paperclip's budget warning at 80% and per-run reservation, a
  fleet-wide pause and stop, three-way approve / reject / request-changes cards, and the Commander
  starting jobs itself.

## User stories

- As a Lead Engineer, I open the Commander after a night with the laptop closed, ask "what happened?",
  and read five sentences, each linked to its job or pull request.
- As Paul, the Product Manager, I ask "what is waiting on me?" and answer two questions from their
  cards without opening four pages; each answer is recorded as mine.
- As a B-E Dev, I click any sentence of the Commander and land on the event or job it came from.
- As a member, I tell the fleet "the design review moved to Thursday", and the next Engineer job
  prints it under `From your people`.
- As a member starting a new mission on the same fleet, I read the fleet notebook and see the lesson
  the last mission left ("the e2e suite times out on the quotes page").
- As a member, I delete a notebook line that is wrong; the Commander stops using it, and the record
  says I deleted it.

## Scope

In: the Commander tab (status line, thread, Waiting on you rail with its cards and their states, Ask
| Message fleet, message receipts, Notebooks drawer, and its states: a first visit, reading, a
thread, off, tokens used up, a card being confirmed), its API routes, the two tables and the `messaged` event kind,
the link filter, the notebook job, the messages in a runner job's claim and in `omni session start`,
the token accounting.

Out: streaming replies, reading the repository's code, the Commander acting on its own (starting,
pausing or stopping a job or a mission), approving a PRD from a card, budget warnings and
reservations, a fleet-wide pause, and any change to ordinary (non-virtual) fleets.

## Test seams

Per `omni kb show testing`: vitest beside the code, a fake model, no network.

- **The model** is a seam: `model.ts` takes a `fetch`; tests pass a fake that returns fixed replies
  and tool calls. No test calls OpenRouter.
- **The link filter** is a pure function (reply → kept sentences): a unit test with sentences linked,
  unlinked, and linked to another fleet's event.
- **The context** is built by the service from a fake repository: a unit test proves it reads only
  the fleet asked about and caps events and messages.
- **The routes**, through their controller: post a message, answer through a card (the existing answer
  route called with the member's sign-in), a non-member refused, the three refusals.
- **The database**, in `supabase/checks/` (ADR-0028): members only, a note without an event refused, a
  deleted note recorded, the 90-day purge, `messaged` holding no text.
- **The notebook job**, as `milestone.ts` is tested: pure step with a fake store and a fake model.
- **The runner side**: the claim's `messages` and the `From your people` block, through `main()` on a
  fixture.
- **The tab**: a component test per state (2.A to 2.G on the before/after page).
- **Evals, before the feature PR is ready**: about 60 questions over recorded fixture fleets, with
  the fake model swapped for the real one only in a script a person runs (`pnpm commander:eval`,
  never in CI): every kept reference valid and of this fleet (100%), claims supported by their
  record (at least 95%, a sample checked by a person), the rail matching the open questions in the
  database (100%), "not found" on unanswerable questions (at least 95%), an injection suite (hostile
  text in an event, a PR title, a message and a notebook line: no card changed, no foreign link, no
  injected notebook line kept), latency p95 under 30 seconds, and tokens per message p50 and p95.
  The results go in the feature PR's body.

## Risks

Merging publishes a new tab on every Virtual Fleet and a new model call billed to the app's OpenRouter
key. Rollback: remove the tab from `FLEET_TABS` (the route then answers nothing), or unset
`OPENROUTER_API_KEY`, which turns the Commander off by itself; the tables stay and are harmless.

- **A person's words leave the product.** Messages and questions are sent to OpenRouter.
  L-GDPR-5 names OpenRouter, accepted without a data-processing agreement by pierrederval on
  2026-11-16; L-GDPR-7 (transfers outside the EU) applies as it already does to the Ask classifier.
- **Prompt injection.** An event sentence, a PR title or a member's message could carry instructions;
  the Commander's tools only read, it can send nothing on its own, and an answer needs a member's
  click, so the worst it can do is say something wrong, which the link filter bounds.
- **The cost.** Bounded by the fleet's daily tokens.

The Legal entries it touches: L-AIACT-1 (every reply signed `Commander · agent`), L-GDPR-1 (the
thread and notes are read by members only), L-GDPR-2 (no credential in a message or a note; secrets
masked in the context sent to the model), L-GDPR-3 (a deleted account's messages are erased, its
answers kept where they already are), L-GDPR-4 (90 days for the thread; decisions kept), L-GDPR-5 and
L-GDPR-7 (OpenRouter).

The locked laws:

- BR-PRODUCT-12: an answer through a card is the existing answer, and is never changed. If broken,
  the terminal acts on words the person no longer stands behind. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: only members see the thread and its cards. If broken, a stranger reads a team's
  questions and answers. Changing it needs @pierrederval or @dervalp to approve the pull request on
  GitHub.
- BR-PRODUCT-63: the Commander's tools read only this workspace's fleet. If broken, an agent reads
  another team's private work. Changing it needs @pierrederval or @dervalp to approve the pull request
  on GitHub.
- BR-PRODUCT-59: the model key stays on the server and is never shown. If broken, a member copies the
  paid key. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-64, BR-PRODUCT-39 and N-PRODUCT-16 are printed for the files touched and
  are kept unchanged.

The business laws:

- BL-APPROVALS-1 (an approval covers exactly the files the approver read): kept. An approval card
  only links to the PRD's page, where approving stays; the Commander approves nothing.
- BL-ASK-1 (a person's answer is never changed or reworded): kept. A card sends the member's own
  choice through the existing answer route; the Commander never rewords it, and a message to the
  fleet is shown to agents as written, signed by its author.
- BL-GATE-1 (a check that does not decide says "not judged"): kept. When the Commander finds nothing
  linked, it says `I could not find that in the fleet's record.`, never that all is well.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The Commander answers with links
  Given a Virtual Fleet with a running mission whose last event is PRD 2817 waiting on a review
  When a member asks the Commander "what is PRD 2817 waiting for?"
  Then the reply is signed "Commander · agent"
  And every sentence of it links to an event, a job, a pull request or a PRD page of that fleet
```

### AC-2 · test

```gherkin
Scenario: A claim without a valid reference is removed
  Given the model replies with one claim citing an event of this turn's context and one claim citing a reference it was never given
  When the reply is saved
  Then only the first claim is kept, its link built by the app
  And the footer says "1 sentence removed: no link."
```

### AC-3 · test

```gherkin
Scenario: The Commander reads only its own fleet
  Given two Virtual Fleets in two workspaces
  When a member of the first asks the Commander anything
  Then the context sent to the model holds no mission, event or job of the second
```

### AC-4 · test

```gherkin
Scenario: A member answers from a question card
  Given a runner job of the fleet waits on a question with two choices
  When a member picks the second choice on its card in the Waiting on you rail and confirms
  Then the job's answer route records that choice, answered by that member
  And the card reads "Answered by" that member, the time and the choice
  And the Commander wrote no answer of its own
```

### AC-5 · test

```gherkin
Scenario: A message reaches the fleet's next job
  Given a running mission of the fleet
  When a member sends "the design review moved to Thursday" to the fleet
  Then a messaged event links to it and holds none of its words
  And the next Engineer job of that mission prints it under "From your people" with its author
```

### AC-6 · test

```gherkin
Scenario: The mission notebook cites its events
  Given a running mission with three events today
  When the notebook job runs
  Then each line it adds to the mission notebook cites at least one of those events
  And a line with no event is refused by the database
```

### AC-7 · test

```gherkin
Scenario: The fleet notebook is written when a mission ends
  Given a mission of the fleet is delivered
  When the notebook job runs
  Then the fleet notebook gains lines citing that mission's events
  And the Commander reads them for the fleet's next mission
```

### AC-8 · test

```gherkin
Scenario: A member deletes a notebook line
  Given a line in the fleet notebook
  When a member deletes it
  Then the record says who deleted it and when
  And the Commander no longer reads it
```

### AC-9 · test

```gherkin
Scenario: A stranger is refused
  Given a person who is not a member of the fleet's workspace
  When they read the thread or post to it
  Then they are refused and see no message, note or card
```

### AC-10 · test

```gherkin
Scenario: The fleet's tokens are used up
  Given the fleet used all its daily tokens
  When a member opens the Commander
  Then the tab says "Tokens used up. Back at" a time in UTC
  And no model call is made
```

### AC-11 · test

```gherkin
Scenario: No model key
  Given the server has no model key
  When a member opens the Fleet page
  Then the Commander tab says "The Commander is off: no model key."
  And the other tabs work as before
```

### AC-12 · test

```gherkin
Scenario: A card answered elsewhere is not answered twice
  Given a card in the Waiting on you rail
  And its question was answered on its own page by another member
  When a member confirms a choice on the card
  Then no second answer is recorded
  And the card reads "Answered by" the other member
```

### AC-13 · test

```gherkin
Scenario: A card comes from its record, not from the model
  Given a runner job's question with the choices "Keep old API" and "Use v2"
  And the model's reply names other choices for it
  When the rail shows its card
  Then the card shows "Keep old API" and "Use v2"
```

### AC-14 · test

```gherkin
Scenario: A message to a fleet with no running mission
  Given a Virtual Fleet with no running mission
  When a member switches the box to Message fleet
  Then the box says "No mission running: no agent will read this."
```

### AC-15 · test

```gherkin
Scenario: An instruction in an event never becomes memory
  Given an event of the mission whose sentence tells the Commander to say all is fine
  When the notebook job runs
  Then no line it adds repeats that instruction
```

### AC-16 · test

```gherkin
Scenario: The rail works without the model
  Given the server has no model key
  And a runner job of the fleet waits on a question
  When a member opens the Commander tab
  Then its card is in the Waiting on you rail and can be answered
```
