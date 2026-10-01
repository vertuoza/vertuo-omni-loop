# Settled outbox items — PRD 859

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-products-in-the-top-bar-trail -->

## s1-01-products-in-the-top-bar-trail — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-products-in-the-top-bar-trail
prd: 859
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Should the top bar say Settings › Products on the new Products pages, like it does for Business and Jev?

## The decision, in plain words

Yes: Products was added to the list of Settings pages the top bar knows, so it reads Settings › Products there, and a product's own page links back to the list.

## The intro, for fun

The new Products page needed a name tag for the top bar.

## The punchline, for fun

One line later, it stopped introducing itself as just Settings.

## The options, in plain words

A. A. Add Products to the Settings pages the top bar names (built).
B. B. Leave the sidebar file alone: the Products pages read as plain Settings in the top bar.

## What I had to decide

Keep Products in the Settings pages the top bar names, or take it out and let the Products pages read as plain Settings.

## What I did meanwhile

The top bar reads Settings › Products on the list and on each product's page.

## What it costs to change later

One line in the sidebar's list of Settings pages, plus its tests; undoing it is removing that line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 lists the sidebar's tests but not the sidebar file itself; the one-line change sits outside the territory as written. (author)

```

<!-- /omni-outbox-settled: s1-01-products-in-the-top-bar-trail -->

<!-- omni-outbox-settled: s1-02-every-member-edits-the-look -->

## s1-02-every-member-edits-the-look — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-every-member-edits-the-look
prd: 859
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Who may change a product's pitch look, given that today every member of a workspace may edit its business?

## The decision, in plain words

The look follows the business: anyone who may edit the business may change it, which today is every member. So in practice every member sees the dropdown; the read-only view is built and tested, but no real account reaches it until the business has its own editors.

## The intro, for fun

The page was built with a velvet rope for people who may not edit.

## The punchline, for fun

Today everyone in the workspace is on the guest list.

## The options, in plain words

A. A. Whoever may edit the business may change the look: any member today (built).
B. B. Only the workspace's owner may change the look; members read it.
C. C. Add a business editor role first, then let only those editors change the look.

## What I had to decide

Keep the look editable by whoever edits the business (any member today), or make it owner-only, or wait for a business editor role.

## What I did meanwhile

Every member of the workspace can change any product's look; nobody signed in to the workspace sees the read-only view.

## What it costs to change later

Making it owner-only later is a one-function change in the database plus the page's flag; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Acceptance criterion 3 (a member who may not edit Business sees the look and no dropdown) cannot be shown with a real account today: the read-only view is proven by the page's render test only. (author)

```

<!-- /omni-outbox-settled: s1-02-every-member-edits-the-look -->

<!-- omni-outbox-settled: s1-03-products-list-reads-only -->

## s1-03-products-list-reads-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-products-list-reads-only
prd: 859
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Should opening Settings › Products set up the business when nobody has opened Settings › Business yet?

## The decision, in plain words

No: the Products list shows the products the business already holds. Until someone opens Business, it is empty and points there.

## The intro, for fun

A brand-new workspace opens Products and finds an empty shelf.

## The punchline, for fun

The sign on the shelf points to Business, where the stock is made.

## The options, in plain words

A. A. The list only reads; an empty list links to Business (built).
B. B. Opening Products sets up the business and its first product, like Business does.

## What I had to decide

Keep the Products list read-only, or have it set up the business (and its first product) the first time it is opened, as Business does.

## What I did meanwhile

A workspace whose Business page was never opened sees no products and a link to Business.

## What it costs to change later

Setting up the business from the Products page later is one call added to its read; nothing stored changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the list shows the products Settings › Business already holds; it does not say whether opening Products may create them. (author)

```

<!-- /omni-outbox-settled: s1-03-products-list-reads-only -->

<!-- omni-outbox-settled: s2-01-demo-pitch-wiring -->

## s2-01-demo-pitch-wiring — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-demo-pitch-wiring
prd: 859
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The demo should show the Pitch panel switched off, but the demo's sample PRD is still being built, so it never shows a Pitch button at all. Should the demo's sample PRD be moved to shipped so the switched-off panel can be seen?

## The decision, in plain words

The page now knows when it is the demo and draws the Pitch panel switched off there, but the demo's sample PRD keeps its current stage, so the demo shows no Pitch button today.

## The intro, for fun

A demo that can pitch, if only its sample would ever ship.

## The punchline, for fun

The panel is ready and waiting; the sample is still at work.

## The options, in plain words

A. A. Keep the demo flag wiring and leave the demo PRD at building: the disabled panel is proven by tests but not visible in the demo.
B. B. Also move the demo PRD's stored stages to shipped, so the demo shows the disabled Pitch panel (and loses its building badge).
C. C. Add a second demo PRD at shipped beside the current one, so both the building badge and the disabled Pitch panel show.

## What I had to decide

Whether the demo dossier's built-in stages move to shipped (or a second demo PRD at shipped is added) so the disabled Pitch panel is visible in demo mode, and whether the two one-line changes outside the slice's territory (view.ts gains an optional demo flag, DossierPage.tsx passes it to StageAction) are kept.

## What I did meanwhile

DossierView carries an optional demo flag, set only on the demo dossier; DossierPage passes it to StageAction, which opens the Pitch panel disabled. demo.ts is unchanged, so the demo PRD stays at building and shows no Pitch.

## What it costs to change later

One line in demo.ts to move the demo's stages, or dropping the optional flag and its two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether moving the demo PRD to shipped would hide the building-stage questions badge the demo shows today (author)

```

<!-- /omni-outbox-settled: s2-01-demo-pitch-wiring -->
