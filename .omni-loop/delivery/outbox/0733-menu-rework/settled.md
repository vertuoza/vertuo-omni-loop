# Settled outbox items — PRD 733

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-settings-redirect-beyond-territory -->

## s1-01-settings-redirect-beyond-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-settings-redirect-beyond-territory
prd: 733
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Moving Settings to one entry at the foot of the menu broke four existing checks and a page rule outside the part of the app this step was allowed to touch. Was it right to update them here?

## The decision, in plain words

Yes: the four checks now describe the new menu, and the Settings address got the small loading screen every app page must have. Nothing a person sees changes beyond what the design asked for.

## The intro, for fun

The menu got tidier, and four old checks noticed the furniture had moved.

## The punchline, for fun

We told them where the sofa went instead of putting it back.

## The options, in plain words

A. Update the checks and add the loading screen in this step, as built.
B. Make the Settings address a server redirect with no page, so no loading screen is needed, and still update the checks.
C. Move the check updates into a separate step that follows this one.

## What I had to decide

Whether updating the checks and adding the loading screen outside the step's declared ground is acceptable, or should be split into its own step.

## What I did meanwhile

The step ships with the four checks updated and the loading screen added, and every check passes.

## What it costs to change later

Undoing it means moving five small file changes to another step; no data or address changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan did not list the headers, sections and fleets checks, nor the settings loading screen, although the menu change forces them.

```

<!-- /omni-outbox-settled: s1-01-settings-redirect-beyond-territory -->
