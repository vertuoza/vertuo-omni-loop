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

<!-- omni-outbox-settled: s2-01-headers-test-top-bar-end -->

## s2-01-headers-test-top-bar-end — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-headers-test-top-bar-end
prd: 438
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The check that looks at every app page's header expected the top bar to end with Game mode. Now that your avatar ends it, may this slice update that check even though the plan gave it to other slices?

## The decision, in plain words

Yes: the check now expects the theme switch and Game mode, then your avatar or the sign-in button, last. Only that one part of the check changed.

## The intro, for fun

The header inspector had a checklist that stopped at Game mode.

## The punchline, for fun

We added one line so it stops being surprised by your face.

## The options, in plain words

A. Update the app-page top bar assertion in the header test to allow the avatar or sign-in button last (built).
B. Leave the header test to s4 or a later slice and ship s2 with the header test red until then.

## What I had to decide

Whether s2 may update the one header check the new avatar broke, outside its planned files.

## What I did meanwhile

The header check expects the avatar or Sign in with GitHub after Game mode on every app page; the rest of the file is untouched.

## What it costs to change later

Reverting means restoring one assertion in the header test; no product code depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s4, which shares this test file in the same wave, expects to own this assertion too (author).

```

<!-- /omni-outbox-settled: s2-01-headers-test-top-bar-end -->

<!-- omni-outbox-settled: s4-01-open-the-app-placement -->

## s4-01-open-the-app-placement — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-open-the-app-placement
prd: 438
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Where does the new link into the app sit on the Docs and Release notes bar: after Game mode, as the design sketch drew it, or before the theme switch?

## The decision, in plain words

It sits right after the Docs and Release notes links and before the theme switch, so Game mode stays the last thing at the top right, as it is on every other bar.

## The intro, for fun

The sketch put the door at the very end of the hallway.

## The punchline, for fun

We moved it one step in, so the game button keeps its corner.

## The options, in plain words

A. Before the theme switch, so Game mode stays last
B. Last, after Game mode, as the sketch drew it
C. First, right after the page's sub-title

## What I had to decide

Keep the link before the theme switch, or move it to the far right after Game mode as the sketch showed.

## What I did meanwhile

The bar reads Release notes, Docs, Open the app, then the theme switch and Game mode.

## What it costs to change later

Moving it is a one-line reorder in the bar and its two tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not order the link; only the before/after sketch shows it last (author)

```

<!-- /omni-outbox-settled: s4-01-open-the-app-placement -->

<!-- omni-outbox-settled: s3-01-headers-test-phone-controls -->

## s3-01-headers-test-phone-controls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-headers-test-phone-controls
prd: 438
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The phone menu button and the small logo now open the app's top bar, so the shared check that reads every app page's top bar had to learn about them. That check belongs to other parts of this work: may this part change it?

## The decision, in plain words

I changed that one check so it expects the menu button and the logo first, then the theme switch and Game mode as before. Nothing else in it moved.

## The intro, for fun

Two new buttons walked into the top bar and the bouncer had a list.

## The punchline, for fun

We added their names to the list rather than hide them in the coat room.

## The options, in plain words

A. Keep the menu button and the logo at the start of the top bar, and let the shared check expect them (built).
B. Move them after the rest of the bar in the page and place them on the left by layout only, so the shared check stays untouched; keyboard order would then differ from what is seen.
C. Draw the phone's first row outside the top bar, as a separate strip that only phones see.

## What I had to decide

Whether the shared page-header check may name the phone menu button and the logo, or whether they should live somewhere the check does not read.

## What I did meanwhile

The check expects the menu button and the logo before the theme switch; on a computer both stay hidden, on a phone they open the bar.

## What it costs to change later

Undoing it is two lines in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan names the shared check as the other slices' ground, and says nothing on whether this slice may extend it (author).

```

<!-- /omni-outbox-settled: s3-01-headers-test-phone-controls -->
