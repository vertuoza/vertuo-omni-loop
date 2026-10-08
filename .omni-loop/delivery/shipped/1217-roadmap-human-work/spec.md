---
prd: 1217
title: A roadmap lists all its human work, by kind
blocked-by: none
spec: file
---

# A roadmap lists all its human work, by kind

**PRD:** #1217 · **Builds on:** PRD 1162 (roadmaps), PRD 812 (Jev decisions) · **Touches:** the
`omni` CLI (`omni roadmap push`), the `/omni:plan` skill (one marker), a Supabase migration (a new
table and `roadmap_push`), the app's Jev registry (a new decision), the roadmap pages of
`apps/galaxy`, and the bundle `kit/dist/omni.mjs`.

## Problem

A roadmap runs many PRDs. Some of their work can only be done by a person, and today that work is
spread across four places, none of which says what kind of work it is:

- the roadmap's `person` open questions (`roadmap.md`, `## Open questions`);
- outbox items ranked `human-action` ("a secret, a grant, a console step") or `high` on each PRD's
  feature branch;
- a PRD the drive parked, written `- loop: parked · <why> · <link>` on its feature PR's status
  comment;
- `/omni:plan`'s `needs clarification` questions, posted on the PRD's issue.

Someone driving a roadmap cannot see, in one place, what human work it still needs, nor who should do
it: a product person, a developer, someone with admin rights on the repository, or whoever deploys to
production. When the roadmap ends, nothing tells what human work it took.

## Solution

The roadmap's page on the Omni app gains one **Human work** item: every piece of human work across the
roadmap's PRDs, each sorted into one of four **kinds**, open ones first, settled ones kept as done.

### The four kinds

| kind | what it holds |
|---|---|
| `business` | a product or business choice: scope, priority, wording, who it is for |
| `development` | a code or design decision a developer makes, a stuck slice, a red CI after its attempts |
| `dev-ops` | a right missing in the repository: a secret, a token scope, a grant, an app permission, branch protection |
| `delivery-ops` | putting the roadmap in production: a deploy, a migration run, a console step, a production setting or variable |

Each kind's description is the text the classifier reads; the closed set is `business`,
`development`, `dev-ops`, `delivery-ops`.

### Gathering (the kit)

`omni roadmap push <n>` adds `humanWork` to the body it sends: one entry per piece of human work it
reads now, each
`{ key, prd, repo, source, text, act, url, ruleKind }`:

| source | read from | key | text | act |
|---|---|---|---|---|
| `question` | each `person` row of `## Open questions` with no answer | `question:<id>` | the question | its recommendation, or null |
| `outbox` | each outbox item ranked `human-action` or `high` on the PRD's open feature branch (its repository's, in a plan repository: each target's) | `outbox:<prd>/<item id>` | the item's title | a `human-action` item's `## What a person must do`, word for word; else null |
| `park` | the `- loop: parked · <why> · <link>` line of the PRD's feature PR status comment | `park:<prd>` | `<why>` | null |
| `clarification` | the latest comment on the PRD's issue that starts with `<!-- omni-needs-clarification -->` and was posted after the PRD's last plan commit, or with no plan yet | `clarification:<prd>` | its first question | the comment's other questions, or null |

`repo` is the repository the work is in (the roadmap's own, or the target's short name in a plan
repository). `url` is where it is answered: the issue comment's, the feature PR's, or the issue's. An
answered `person` question, an outbox item settled or adopted, a PRD no longer parked, and a plan
written after the clarification are not read: they are done (below).

**The rule kind.** Every entry carries `ruleKind`, worked out by pure rules, so the list always reads
even when the classifier is off:

1. `question` → `business`;
2. `text` or `act` names a secret, token, scope, permission, grant, access or branch protection →
   `dev-ops`;
3. `text` or `act` names deploy, production, prod, migration run, console, environment variable →
   `delivery-ops`;
4. otherwise → `development`.

The words are matched whole and case-insensitively; rule 2 is tried before rule 3.

`/omni:plan`'s `needs clarification` comment now starts with the line
`<!-- omni-needs-clarification -->`, so the push finds it.

### Storing and classifying (the app)

`POST /api/roadmaps` takes `humanWork` (optional: a kit without it changes nothing stored) and
`roadmap_push` keeps it in a new table, `roadmap_human_work`, one row per roadmap and key:
`prd, repo, source, text, act, url, kind, kind_by ('jev' | 'rule'), state ('open' | 'done'),
first_seen_at, done_at`.

- **A new key** is classified once. When the Jev decision `hitl-category` is **On**, its answer is the
  kind (`kind_by = 'jev'`); **Shadow** asks it and records its answer in Jev's usual log, keeping the
  rule kind; **Off**, a Jev error, or an answer outside the four keeps the rule kind
  (`kind_by = 'rule'`). The push never fails because of the classifier.
- **A key already stored** keeps its kind; its text, act and url are refreshed.
- **A key missing from a push** becomes `done`, with `done_at` the push's time; a key that comes back
  reopens (`open`, `done_at` null). A push carrying no `humanWork` field closes nothing.
- `hitl-category` is a Choice decision over the four kinds, registered like `question-category`, and
  set Off / Shadow / On on the Jev settings page like the others. Its state is the entry's source,
  text, act, repository and the PRD's title.
- Row-level security as `roadmap_prds`: a workspace member reads its roadmaps' rows; only
  `roadmap_push` writes them.

### The page

- **The roadmap's page** shows, under the Gantt and above the open questions, one **Human work** item:
  a chip per kind with its open count (`business 2 · development 1 · dev ops 1 · delivery ops 3`),
  then the open entries grouped by kind, each with its PRD, its repository, its text, its act word for
  word when it has one, and a link to where it is answered; then, folded, the done entries with the
  same fields and when they were settled. With no entry at all, the item says
  `No human work recorded yet.`
- **The roadmap list** shows, on each card, the open counts per kind beside "what blocks it now",
  only the kinds with at least one.

## Decisions

- **Gathered at push, not written in `roadmap.md`.** Human work appears while PRDs are built; the
  roadmap file is planned before any of it exists. The push already runs every drive tick.
- **All four sources,** each linking back to where it is answered (asked and chosen).
- **Jev in the app, rules in the kit** (asked and chosen): Jev classifies once per key; the kit's
  rule kind keeps the list whole when Jev is off or fails.
- **Done items are kept,** so a finished roadmap still tells what human work it took.
- **The voice's objection, accepted.** persona:B-E DEv: "A categorised list is still just another
  board I won't read. If a dev-ops item doesn't say exactly which secret or scope is missing in which
  repo, it's fluff to me." Each entry shows its repository, and a `human-action` item's
  `## What a person must do` word for word.
- **No proof video** (asked: no).

## User stories

- As a PM driving a roadmap, I see what human work it waits on, by kind, so I hand business questions
  to myself and dev-ops items to the person with admin rights.
- As a lead engineer, I see the development items across the roadmap's PRDs in one list.
- As whoever deploys, I see every delivery-ops step the roadmap needs before it can reach production.
- At the end of a roadmap, anyone sees how much human work of each kind it took.

## Scope

In: the gathering and rule kind in `omni roadmap push` (both repository shapes), the marker in
`/omni:plan` (and `/omni:ultra-yolo`'s plan step when it posts the same comment), the migration and
`roadmap_push`, the `hitl-category` Jev decision, the Human work item on the roadmap page and the
counts on the list, the guide `docs/guide/roadmaps.md`, and the bundle.

Out: answering human work from the page; changing outbox ranks or adding a kind field to outbox
items; notifications; human work outside a roadmap.

## Test seams

- `kit/lib/roadmap/human-work.ts`, pure: each source turned into entries from fixture inputs, the
  keys, the cuts, and every rule-kind rule (vitest, beside it). `push.ts`'s body test gains
  `humanWork`, read through the `gh` and `git` functions handed in, as today.
- The plan skill's marker: the skill text is checked by the existing skill tests where they read it.
- `supabase/checks/roadmaps.sql`: a new key stored with its kind, a key missing becomes done, a key
  back reopens, a push without `humanWork` closes nothing, RLS for a non-member.
- `apps/galaxy/src/jev/decisions/hitl-category.test.ts`: the state it reads, an answer in the set
  kept, one outside dropped; the route test for Off / Shadow / On and a Jev error.
- The page model (`src/roadmap/page/model.ts`): counts per kind, open before done; a component test
  of the Human work item, including the empty line.

## Risks

Merging publishes a migration to production Supabase (a new table and a redefined `roadmap_push`)
and a new kit bundle. Rollback: the table is additive and `humanWork` optional, so reverting the PR and
shipping a migration that restores the previous `roadmap_push` leaves roadmaps reading as before; the
table can then be dropped. Jev's decision starts **Off**, so nothing is sent to Jev until a member
turns it on.

## Acceptance criteria

- Pushing a roadmap whose PRD has a `human-action` outbox item naming a missing secret shows, on the
  roadmap's page, one open `dev ops` entry with that PRD, its repository and the item's
  `What a person must do` text, with Jev off.
- An unanswered `person` question shows as an open `business` entry; once answered and pushed again,
  it shows under done with when it was settled.
- A PRD parked by the drive shows an open entry with the park's why and a link to its feature PR.
- A `needs clarification` comment from `/omni:plan` shows an open entry linking the PRD's issue.
- With `hitl-category` On, a new entry's kind is Jev's answer; an answer outside the four, or a Jev
  error, keeps the rule kind and the push succeeds.
- An entry already classified keeps its kind across pushes.
- The roadmap list's card shows the open count of each kind that has one.
- A push from a kit without `humanWork` leaves the stored entries unchanged.
