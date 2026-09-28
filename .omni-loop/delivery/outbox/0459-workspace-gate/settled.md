# Settled outbox items — PRD 459

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-install-link-added-by-app -->

## s1-01-install-link-added-by-app — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-install-link-added-by-app
prd: 459
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When nobody's workspace owns a repository yet, who writes the link to install the Omni App: the database or the web app?

## The decision, in plain words

The database says no workspace owns the repository yet and to install the Omni App; the web app adds the install link it already knows, so the link follows whichever App a deployment uses.

## The intro, for fun

Every refusal deserves a door, and every door deserves a doorknob.

## The punchline, for fun

The database names the door; the web app hands over the knob.

## The options, in plain words

A. The database ends with the hint and the web app adds its own install link, so preview and production each link their own App.
B. The database writes the whole sentence with the link fixed in the migration, so nothing is added after it.
C. Leave the link out everywhere and let the guide tell people where to install the App.

## What I had to decide

Whether the install link belongs in the database's message or is added by the web app from its own App setting.

## What I did meanwhile

Refusals for an unowned repository end with the install link wherever the web app knows the App's name, and with the hint alone where it does not.

## What it costs to change later

A constant: moving the link into the database is one follow-up migration and deleting a small helper.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The web app recognises the database's hint by its closing words, so rewording that sentence in the database means changing the helper's constant too (author).

```

<!-- /omni-outbox-settled: s1-01-install-link-added-by-app -->

<!-- omni-outbox-settled: s1-02-dossier-reason-on-403-only -->

## s1-02-dossier-reason-on-403-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-dossier-reason-on-403-only
prd: 459
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When the Omni page refuses a dossier, should the terminal show the page's explanation for every kind of refusal or only when access is refused?

## The decision, in plain words

The terminal shows the page's explanation only when access is refused; other refusals, like a file that is too large, keep their short status as before.

## The intro, for fun

A terminal that explains everything is a terminal nobody reads.

## The punchline, for fun

So it only explains the one refusal people cannot guess.

## The options, in plain words

A. Print the reason only after an access refusal, and keep every other refusal as it was.
B. Print the reason after every refusal that carries one.
C. Never print a reason, and send people to the page instead.

## What I had to decide

Whether the dossier command prints the page's reason after every refused status, or only after an access refusal.

## What I did meanwhile

An access refusal reads with its reason; every other refusal reads exactly as it did before this change.

## What it costs to change later

A constant: printing the reason for every status is one condition removed and a few expected lines updated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a too-large or malformed refusal would be clearer with its reason was not asked of anyone (author).

```

<!-- /omni-outbox-settled: s1-02-dossier-reason-on-403-only -->
