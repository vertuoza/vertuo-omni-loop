# Settled outbox items — PRD 1272

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-page-kinds-stay-narrow -->

## s1-01-page-kinds-stay-narrow — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-page-kinds-stay-narrow
prd: 1272
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Which part of the work teaches the existing pages that a concept is a kind of dossier?

## The decision, in plain words

The database and the upload now accept concepts, but the existing pages still know only PRDs and fixes. The slices that build the Concepts pages widen them, before any concept is uploaded.

## The intro, for fun

A new guest is on the list at the door, but the seating plan has not heard of them yet.

## The punchline, for fun

Someone has to add a chair before the guest actually shows up.

## The options, in plain words

A. Keep the pages' kinds as they are here, and have the next slice that adds concepts to the menu widen them before any concept is uploaded.
B. Widen the pages' kinds now, editing five page files outside this slice's ground with placeholder entries.
C. Have the database's history list leave concepts out, and give the Concepts list a read of its own.

## What I had to decide

Whether the pages' own list of dossier kinds (and of version kinds) grows in this first slice, or with the Concepts pages that read them.

## What I did meanwhile

The galaxy store keeps WORK_KINDS and ARTIFACT_KINDS (what the pages read) as they were, and adds PUSH_KINDS and PUSHED_ARTIFACT_KINDS for the push and the lookup. Widening WORK_KINDS here would have broken the type of five files outside this slice's territory (dossier/page/work.ts, view.ts, DossierPage.tsx, fixes/FixList.tsx, fixes/FixListRoute.tsx). The catch: data/dossiers.ts parses dossier_list() rows strictly (kind in WORK_KINDS, latest keyed by ARTIFACT_KINDS), and the database's dossier_list() does return concept rows, so workspaceDossiers() (the dashboard) throws once one concept is pushed, until WORK_KINDS and ARTIFACT_KINDS take the concept's kinds. /prd, /visual and /bugs read unparsed rows filtered by kind, and are unaffected.

## What it costs to change later

One edit in s2 or s3: fold PUSH_KINDS into WORK_KINDS and PUSHED_ARTIFACT_KINDS into ARTIFACT_KINDS, with the kind maps that then need a concept entry. No migration either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- data/dossiers.ts and dossier/page/DossierPage.tsx are in no slice's territory, so the plan names nobody to widen them (author)

```

<!-- /omni-outbox-settled: s1-01-page-kinds-stay-narrow -->

<!-- omni-outbox-settled: s2-01-dashboard-skips-concepts -->

## s2-01-dashboard-skips-concepts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-dashboard-skips-concepts
prd: 1272
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Now that concepts are stored with the other work, should the dashboard count them with the PRDs and fixes?

## The decision, in plain words

The dashboard reads a concept without failing and leaves it out: it keeps counting PRDs and fixes only, and concepts have their own list.

## The intro, for fun

A new kind of guest arrived, and the head count at the door did not know how to count them.

## The punchline, for fun

So the door now waves them through to their own room instead of slamming shut.

## The options, in plain words

A. A. The dashboard reads concepts and leaves them out, counting PRDs and fixes only.
B. B. The dashboard keeps concepts in its rows, and its panels learn to show them.
C. C. The database's history list leaves concepts out, and the Concepts list reads them its own way.

## What I had to decide

Whether the dashboard's read of all the workspace's dossiers keeps concept rows, or reads them and leaves them out. It sits in apps/galaxy/src/data/dossiers.ts, outside this slice's territory: without the change, the dashboard would throw as soon as one concept is pushed (the carry-over from s1-01-page-kinds-stay-narrow).

## What I did meanwhile

apps/galaxy/src/data/dossiers.ts: workspaceDossiers() now parses each row of dossier_list() with a wider schema (kind may be concept, latest may hold a concept's four version kinds), then drops concept rows and parses the rest with the unchanged DossierListEntry. DossierListEntry and DossierListRow are unchanged. A test in dossiers.test.ts pushes a concept row through the fake and checks the dashboard lists the other dossiers alone. In the same slice, WORK_PATHS and WORK_NAMES (src/dossier/page/work.ts) name the concept, and ofWork keeps a concept out of every other kind's rows.

## What it costs to change later

One filter to remove in workspaceDossiers() if the dashboard should count concepts later, plus whatever the board then shows for them. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec puts the board counting concepts out of scope, which I read as: the dashboard leaves them out (author)

```

<!-- /omni-outbox-settled: s2-01-dashboard-skips-concepts -->

<!-- omni-outbox-settled: s2-02-concepts-sign-in-via-prds -->

## s2-02-concepts-sign-in-via-prds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-concepts-sign-in-via-prds
prd: 1272
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When someone who is not signed in opens the Concepts list, how do they sign in?

## The decision, in plain words

The page tells them to sign in from the PRDs page and links to it; once signed in, they come back to Concepts from the menu.

## The intro, for fun

The Concepts room opened before anyone fitted it with its own front door.

## The punchline, for fun

For now, guests use the PRDs entrance next door and walk over.

## The options, in plain words

A. A. Point a signed-out person to the PRDs page's sign-in.
B. B. Give /concepts its own sign-in callback, so it comes straight back to the list.

## What I had to decide

Whether /concepts gets its own sign-in that returns to it, which needs a /concepts/callback route outside this slice's territory (app/concepts/page, layout and loading only), or points to the sign-in /prd already has.

## What I did meanwhile

Signed out, /concepts shows a card "Sign in to see your workspace's concepts" with a link to /prd, whose sign-in returns to /prd. The other states: no database (closed), the demo (empty list) and a failed read (the dossier database notice), each covered by src/concepts render and state tests. The date on each card is the concept dossier's creation date, the first push of the concept.

## What it costs to change later

One callback route, app/concepts/callback/route.ts, copied from app/bugs/callback with WORK_PATHS.concept, and the page then renders DossierSignIn with a concept copy. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 names no callback route, and the spec does not say how a signed-out person reaches /concepts (author)

```

<!-- /omni-outbox-settled: s2-02-concepts-sign-in-via-prds -->

<!-- omni-outbox-settled: s5-01-dossier-push-skill-concept -->

## s5-01-dossier-push-skill-concept — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-dossier-push-skill-concept
prd: 1272
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The helper that sends files to the Omni page still describes only plans and fixes. Should its own instructions also explain sending a concept?

## The decision, in plain words

The two concept steps call the helper with the concept kind, and the command already accepts it. The helper's own instructions were left as they are, because changing them was outside this part of the work.

## The intro, for fun

The messenger knows the new address, but its address book still lists only the old ones.

## The punchline, for fun

It delivers fine; it just cannot tell you it does.

## The options, in plain words

A. A. Leave the dossier-push skill's text as it is; the callers name the kind and the command accepts it.
B. B. Add --kind concept to the dossier-push skill's description, input and push section in a follow-up change.
C. C. Have the concept steps run omni dossier push directly instead of following the skill.

## What I had to decide

Whether the dossier-push skill's text should name --kind concept in its description, its input and its push section, in a follow-up change.

## What I did meanwhile

/omni:think-big and /omni:brainstorm --concept follow /omni:dossier-push <n> --kind concept; the skill says to pass the kind as given, and omni dossier push accepts concept, so the push runs. Only the skill's own wording lists visual and bug alone.

## What it costs to change later

One small text change to kit/plugin/skills/dossier-push/SKILL.md, in any later slice or fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an agent reading the dossier-push skill would refuse a kind its text does not list was not tested (author).

```

<!-- /omni-outbox-settled: s5-01-dossier-push-skill-concept -->
