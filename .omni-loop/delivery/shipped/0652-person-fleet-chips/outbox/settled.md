# Settled outbox items — PRD 652

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-people-lookup-takes-printed-name -->

## s1-01-people-lookup-takes-printed-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-people-lookup-takes-printed-name
prd: 652
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a screen asks the people directory for someone, should the screen keep the name it already shows, or should the directory choose the name?

## The decision, in plain words

The screen keeps the name it already shows, and the directory only adds the face and the fleet. Names on every screen stay exactly as they are today.

## The intro, for fun

Every face needs a name tag, and someone has to write it.

## The punchline, for fun

We let each screen keep its own pen.

## The options, in plain words

A. A: the lookups take the name the screen prints, and add only the face and the fleet (built)
B. B: the lookups return the roster's name, and screens switch to it
C. C: both: the name argument is optional, falling back to the roster's name

## What I had to decide

Whether the directory lookups take the name the screen prints (built), or return the roster's name themselves.

## What I did meanwhile

Wave-2 slices call byId(userId, name) and byLogin(login, name?) from src/people/load.ts; the name defaults to the login for byLogin.

## What it costs to change later

Changing it later is a small edit in src/people/load.ts and at each call site in wave-2 slices; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names byId(userId) and byLogin(login) without a name argument; the extra argument keeps the spec's rule that names a screen prints stay as they are (author).

```

<!-- /omni-outbox-settled: s1-01-people-lookup-takes-printed-name -->

<!-- omni-outbox-settled: s2-01-board-load-test-outside-territory -->

## s2-01-board-load-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-board-load-test-outside-territory
prd: 652
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The workspace board's fleet ranking now carries each fleet's colour and mascot, and one existing check of that ranking sat outside this piece of work's agreed files. May it be updated here?

## The decision, in plain words

I updated that one check so it expects the colour and mascot too, since the spec names it as the check for this change, and changed nothing else outside the agreed files.

## The intro, for fun

One test was standing just outside the fence, waving a sign that said 'me too'.

## The punchline, for fun

We let it in, checked its shoes, and closed the gate behind it.

## The options, in plain words

A. Keep the test edit in this slice, as the spec's test seams ask (what was built).
B. Move the edit to its own follow-up; this test would fail until it lands.

## What I had to decide

Whether the board's loader test may be changed by this slice, as the spec's test seams ask, although the plan left it out of the slice's territory.

## What I did meanwhile

The test expects each ranked fleet's colour and mascot; every other file outside the territory is untouched.

## What it costs to change later

Reverting is one test edit: drop the colour and mascot from the expected ranking rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan does not say why the board's loader test was left out of this slice's territory while the spec names it (author).

```

<!-- /omni-outbox-settled: s2-01-board-load-test-outside-territory -->

<!-- omni-outbox-settled: s4-01-ask-members-carry-faces -->

## s4-01-ask-members-carry-faces — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-ask-members-carry-faces
prd: 652
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Where should the ask screens get each person's picture from: from the member list they already read, or from a separate read on each screen?

## The decision, in plain words

The member list the ask screens already read now also brings each person's picture, so every screen that reads it (ask, dossier, the waiting list) gets the pictures without asking twice.

## The intro, for fun

Everyone on the ask screens now shows a face, but someone had to fetch the photos.

## The punchline, for fun

The member list went shopping once and came back with pictures for everybody.

## The options, in plain words

A. The shared member list brings the pictures for every screen that reads it (built).
B. Only the ask pages fetch the pictures, with a reader of their own.

## What I had to decide

Whether the shared member read should also read the people directory for every screen that uses it.

## What I did meanwhile

readMembers reads ask_members and the people directory in parallel and adds a face to each member; the dossier and waiting callers get the extra field and one extra roster and fleets read per workspace.

## What it costs to change later

Undoing it is moving the directory read into the ask entry points; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The question page's route under app/ is outside this slice's territory, so the face had to ride on readMembers, which that route already calls (author).

```

<!-- /omni-outbox-settled: s4-01-ask-members-carry-faces -->

<!-- omni-outbox-settled: s6-01-timeline-faces-directory -->

## s6-01-timeline-faces-directory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-timeline-faces-directory
prd: 652
slice: s6
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On a fix's page, the Timeline now shows a face beside each person, but that page belongs to the dossier screens. Should the Timeline show members' arcade heroes, or is their GitHub photo enough there for now?

## The decision, in plain words

The Timeline shows each person's GitHub photo for now. It is ready to show heroes as soon as the fix page hands it the workspace's list of people, a one-line change on the dossier side.

## The intro, for fun

Every face on the fix timeline showed up, but some forgot their costumes at home.

## The punchline, for fun

GitHub photos for now; the capes arrive once the page passes the guest list.

## The options, in plain words

A. Timeline takes an optional list of people and falls back to GitHub photos; the dossier page passes it in a follow-up.
B. Widen this slice into the dossier page to load the list of people and pass it now.
C. Keep GitHub photos on the Timeline for good; heroes only on the fix lists.

## What I had to decide

Whether the fix page should pass the workspace's people to its Timeline, so members appear as their heroes there too.

## What I did meanwhile

Every Timeline line shows the person's public GitHub photo beside the same words; nothing else changes.

## What it costs to change later

One line in the dossier page that draws the Timeline, plus one test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s5 (dossier screens, same wave) already loads the people directory on the fix page was not visible from this slice (author).

```

<!-- /omni-outbox-settled: s6-01-timeline-faces-directory -->
