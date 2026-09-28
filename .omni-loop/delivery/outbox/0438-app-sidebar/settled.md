# Settled outbox items — PRD 438

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-fleets-card-test-moved-to-sidebar -->

## s1-01-fleets-card-test-moved-to-sidebar — adopted

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
id: s1-01-fleets-card-test-moved-to-sidebar
prd: 438
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The Fleets page had a test that checked the home page's Fleets card. The card is gone, so what should that test check now?

## The decision, in plain words

We changed that one test to check that the sidebar's Fleets item leads to the Fleets page, even though the fleets tests were not on this slice's list of files.

## The intro, for fun

A signpost was taken down, and its test was left pointing at empty air.

## The punchline, for fun

So the test now points at the new signpost, a little to the left.

## The options, in plain words

A. Edit the one fleets test to check the sidebar item, the option built.
B. Delete the fleets test block, and let the sidebar tests alone cover the Fleets link.
C. Keep the old home page cards alive only for that test, against the spec's removal.

## What I had to decide

Whether a test file outside the slice's territory (the fleets page's render test) may be edited to follow the removal of /app's section cards.

## What I did meanwhile

apps/galaxy/src/fleets/render.test.ts no longer imports the deleted Cards.tsx; its last block checks SIDEBAR's Fleets item links to /app/fleets.

## What it costs to change later

One test block, easy to move or drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant to list src/fleets/render.test.ts in s1's territory and left it out by oversight (author)

```

<!-- /omni-outbox-settled: s1-01-fleets-card-test-moved-to-sidebar -->

<!-- omni-outbox-settled: s1-02-knowledge-repo-chip-above-the-map -->

## s1-02-knowledge-repo-chip-above-the-map — adopted

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
id: s1-02-knowledge-repo-chip-above-the-map
prd: 438
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The knowledge page names the repository it reads. Where exactly should that name sit now that the page has no bar of its own?

## The decision, in plain words

The repository name sits as a small chip on its own line at the top of the page, beside the star chart link, above the map and its title.

## The intro, for fun

The repository's name lost its seat on the bus and had to find a spot on the page.

## The punchline, for fun

It picked the front row, next to the star chart.

## The options, in plain words

A. A heading row above the map, holding the chip and the star chart link, the option built.
B. Inside the map's own title, beside the domain's name.
C. In the top bar, after the page's title.

## What I had to decide

Whether the repository chip on /knowledge goes in a heading row above the map (built) or inside the map's own title.

## What I did meanwhile

KnowledgeScreen renders a km-page-head row (repository chip, then Open the star chart) in every state, above the map; the map's own h1 is unchanged.

## What it costs to change later

A few lines of markup and CSS; moving it into the map's title means editing KnowledgeMap.tsx, outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's words, in its heading, meant the map's own title (author)

```

<!-- /omni-outbox-settled: s1-02-knowledge-repo-chip-above-the-map -->

<!-- omni-outbox-settled: s1-03-demo-viewer-is-signed-in -->

## s1-03-demo-viewer-is-signed-in — adopted

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
id: s1-03-demo-viewer-is-signed-in
prd: 438
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

On a local run with no database, should the app's sidebar and top bar act as if someone is signed in?

## The decision, in plain words

Yes: on a local run with no database, the app shows the demo player as signed in, with no workspace name, and For me counts the demo's one shared question.

## The intro, for fun

Nobody is really home in the demo, but the lights are on.

## The punchline, for fun

So the demo player gets to sit in the chair.

## The options, in plain words

A. Signed in as the demo player, the option built.
B. Signed out, so the demo shows Sign in with GitHub in the top bar.

## What I had to decide

What the viewer read returns in the demo mode (no Supabase, not production).

## What I did meanwhile

viewerLive() returns signedIn true, name DAM-DEV, login dam-dev, no avatar, no workspace name, and forMe from the demo's For me list; a closed deployment is signed out.

## What it costs to change later

One branch in viewerLive.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether anyone relies on the demo showing Sign in, not asked (author)

```

<!-- /omni-outbox-settled: s1-03-demo-viewer-is-signed-in -->
