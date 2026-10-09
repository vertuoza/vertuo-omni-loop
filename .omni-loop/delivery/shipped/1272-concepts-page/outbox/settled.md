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
- Stays here: This is a temporary sequencing choice between slices with a one-edit reversal and no lasting behaviour or guarantee to record.

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
- Became: BR-PRODUCT-92

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
- Stays here: A slice-territory routing choice, cheap to change by adding one callback route; it guarantees nothing lasting the knowledge base should keep.

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
- Stays here: A local, cheaply reversible wording choice about one skill's text; nothing lasting about product behaviour to record.

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

<!-- omni-outbox-settled: s3-01-missing-file-reads-too-large -->

## s3-01-missing-file-reads-too-large — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 3
- Stays here: An interim, cheap-to-change page choice tied to exact label copy. Nobody approved it, and it awaits a push change, so no lasting guarantee belongs in the knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-missing-file-reads-too-large
prd: 1272
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When one of a concept's files is not on the page, how can the page tell whether it was too large to send or simply never existed?

## The decision, in plain words

It cannot tell, so any file of a concept that is not on the page reads "not sent: too large" on its tab, as the spec asks, never as missing.

## The intro, for fun

A parcel never arrived, and the post office only remembers that it did not come.

## The punchline, for fun

So the note on the door blames the size of the box, every time.

## The options, in plain words

A. A. Every absent file of a concept reads "not sent: too large", as built.
B. B. The push tells the server which files it held back, and only those read "not sent: too large"; any other absent file reads as not recorded.
C. C. An absent file reads "not sent: too large, or not recorded".

## What I had to decide

Whether a tab with no version reads "not sent: too large" for every absent file, or whether the push should also tell the server which files it held back, so the page can say "too large" only when that is true.

## What I did meanwhile

ConceptPage.view.ts marks a tab "not sent: too large" (badge and pane) whenever the concept dossier holds no version of its kind: concept-record for Overview and Areas, vision, board, debate. omni dossier push --kind concept names a file over 512 KiB on stderr and sends nothing about it, and a folder with no vision.html sends the rest (s1), so the server never learns why a file is absent.

## What it costs to change later

To say it only when true: the push sends the names of the files it held back, the migration stores them per dossier, and the page reads them. A follow-up migration plus a change in the kit and the page; nothing to undo here but one condition.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a file too large "never shows as missing" but the push from s1 does not tell the server which files were too large.

```

<!-- /omni-outbox-settled: s3-01-missing-file-reads-too-large -->

<!-- omni-outbox-settled: s3-02-concept-pr-link-is-a-search -->

## s3-02-concept-pr-link-is-a-search — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 3
- Stays here: A temporary stopgap that one line in ConceptPage.view.ts replaces once s4 lands, so there is no lasting guarantee for the knowledge base to keep.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-concept-pr-link-is-a-search
prd: 1272
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

The concept's page links to its review on GitHub, but it does not yet know that review's number. Where should the link go?

## The decision, in plain words

The link opens GitHub's search for the review that refers to the concept's issue, which finds it in one click, until the next part of the work reads the review itself.

## The intro, for fun

The page knows the review exists, it just has not been told the room number.

## The punchline, for fun

So it points at the corridor and trusts you to read the doors.

## The options, in plain words

A. A. Link GitHub's search for the pull request that refers to the issue, until s4 reads the pull request.
B. B. Show no concept PR link until s4 reads the pull request.
C. C. Read the pull request from GitHub on the page now, ahead of s4.

## What I had to decide

Whether the header's concept PR link is a GitHub search until s4 stores the pull request, or waits to appear until then.

## What I did meanwhile

ConceptPage.view.ts links "concept PR" to https://github.com/<repo>/pulls?q=is:pr "Refs #<n>", the line /omni:think-big puts first in the concept PR's body. The page reads no GitHub; the concept's slug, which names its branch, is not stored in the dossier, so the exact branch cannot be named either.

## What it costs to change later

One line in ConceptPage.view.ts once s4 stores the pull request in fix_facts: link its url instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives the PR's facts to s4, and the dossier keeps no slug to build the branch name from.

```

<!-- /omni-outbox-settled: s3-02-concept-pr-link-is-a-search -->

<!-- omni-outbox-settled: s4-01-concept-read-in-the-shared-reader -->

## s4-01-concept-read-in-the-shared-reader — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 4
- Became: ADR-0094

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-concept-read-in-the-shared-reader
prd: 1272
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

To know whether a concept is in review or in the inbox, the app must ask GitHub about it. Which part of the app does the asking?

## The decision, in plain words

The same part that already asks GitHub about each fix now asks about concepts too, with its own short memory, so no second connection to GitHub is built.

## The intro, for fun

The concept needed a messenger to GitHub, and one was already walking that road every day.

## The punchline, for fun

So it got one more letter to carry, not a second messenger.

## The options, in plain words

A. A. Ask GitHub about a concept through the part that already asks about fixes, as built.
B. B. Give concepts their own way of asking GitHub, repeating how the app signs in to GitHub.
C. C. Ask GitHub nothing about concepts, and show their state only from what the push sends.

## What I had to decide

Whether the concept's GitHub read goes in the shared GitHub reader (outside this slice's ground), or in a reader of its own inside it.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

apps/galaxy/src/dossier/github/reader.ts gains a ConceptReader: concept(ref, { priority }) reads the repository's branches.concept from its config and calls readConceptFacts (fix.ts), through its own 60-second cache; the fix and concept reads share one helper (numbered). apps/galaxy/src/dossier/github/server.ts widens dossierGithub()'s type to include it, and reader.test.ts covers the concept read. These three files are outside s4's territory: the token, the installation and the repository's config live only in reader.ts, so no read of a concept could be made from inside the territory without copying them.

## What it costs to change later

Moving the read later is one method and its test moved to another file; nothing is stored differently and no migration is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names apps/galaxy/src/dossier/github/fix as the territory for the read, but the reader that holds the GitHub token and the config, reader.ts, is not in it.

```

<!-- /omni-outbox-settled: s4-01-concept-read-in-the-shared-reader -->

<!-- omni-outbox-settled: s4-02-concept-state-unknown-until-read -->

## s4-02-concept-state-unknown-until-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 4
- Became: BR-PRODUCT-93

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-concept-state-unknown-until-read
prd: 1272
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

What does a concept show when its review has not been found on GitHub, or has not been checked yet?

## The decision, in plain words

It shows "state unknown" in both cases. The list never asks GitHub itself: it shows what was last stored, which the regular sync or a visit to the concept's page fills in.

## The intro, for fun

Nobody has checked on the concept yet, and the page refuses to guess how it is doing.

## The punchline, for fun

Honest beats hopeful: it says it does not know until someone looks.

## The options, in plain words

A. A. Show "state unknown" for no pull request found and for not read yet, as built.
B. B. Show a separate "no concept PR" chip when none is found on the concept's branch.
C. C. Have the list ask GitHub for a concept with no stored facts, at the cost of GitHub reads on every view.

## What I had to decide

Two cases the spec does not name: a concept with no open or merged pull request on its branch (closed without merging, or renamed), and a concept the sync has not read yet.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

conceptState (src/concepts/state.ts) gives 'unknown' when the stored pull request is UNREAD or null, as well as with no stored facts. /concepts reads only fix_facts, as the signed-in person, one read per workspace, never GitHub; a new concept reads 'state unknown' until the stages sync (every 15 minutes) or its own page stores its facts. The page reads the stored facts first and, with none, asks GitHub once and stores the answer after the response.

## What it costs to change later

One branch in conceptState to show another word (for example "closed") for a concept with no pull request, or one read in the list to ask GitHub when nothing is stored. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names only an open pull request, a merged one, and one that could not be read.

```

<!-- /omni-outbox-settled: s4-02-concept-state-unknown-until-read -->
