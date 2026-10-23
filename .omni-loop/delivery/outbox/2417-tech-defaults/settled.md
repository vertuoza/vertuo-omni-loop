# Settled outbox items — PRD 2417

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-settings-folder -->

## s1-01-settings-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-settings-folder
prd: 2417
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Where in the workspace's settings repository do the shared rules for how agents work live?

## The decision, in plain words

In one folder of their own beside that repository's own knowledge, laid out like a knowledge folder, so a plan repository's own rules and the rules it sets for every repository never mix.

## The intro, for fun

Every workspace needs a shelf for the house rules, away from the books it reads itself.

## The punchline, for fun

We put the shelf up next door, so nobody mistakes the house rules for a diary.

## The options, in plain words

A. A. A settings folder of its own, beside the repository's own knowledge and laid out like it: the option built.
B. B. A folder inside the repository's own knowledge folder, so the knowledge base holds both and one tree shows them.
C. C. A folder at the repository's root, outside the kit's footprint, named by the workspace on the Omni page.

## What I had to decide

Whether the settings repository keeps its tech playbook at `.omni-loop/settings/` (`playbook/<form>.md`, the decisions form at `adr/README.md`), beside its own `.omni-loop/knowledge/`. Built that way in `kit/lib/omni-settings/layout.ts` (`SETTINGS_DIR`, `settingsFilePath`, `formOfSettingsPath`); the local copy at `.omni-loop/local/tree/omni-settings/` mirrors it path for path, and the kit's curated pages sit at `kit/templates/omni-settings/` in the same layout. A plan repository's own playbook is the plan repository level of the tree, so its settings folder cannot be its knowledge folder.

## What I did meanwhile

Slices s3 (the Omni page's read route), s5 (this repository's first settings pages) and s7 (the edit's pull request) all take the path from this one module, so moving the folder is one constant.

## What it costs to change later

Before s5 merges, one constant and its tests. After a workspace's settings repository holds pages there, moving it means moving their files in each settings repository too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the settings repository holds plain playbook files but names no folder; the plan asks for this choice to be recorded because the plan repository's own knowledge is another level.
- (author) Whether the settings folder should also hold the Omni settings level's product knowledge later (product registers) is left to the PRD that writes that side.

```

<!-- /omni-outbox-settled: s1-01-settings-folder -->

<!-- omni-outbox-settled: s1-02-owner-line -->

## s1-02-owner-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-owner-line
prd: 2417
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Where does a shared rules page say who approves a change to it, and what does it say when nobody was named?

## The decision, in plain words

Each page names its owners in its header; a page that names nobody belongs to the people who already own the repository's laws. The copy a laptop reads leaves that line out, since only the settings page needs it.

## The intro, for fun

Every rulebook page wants a name on the door, even if the door says 'ask the usual people'.

## The punchline, for fun

The usual people got the keys; the laptop just gets the rules.

## The options, in plain words

A. A. An owner key in the page's header, a list of logins or null for the law owners, left out of the laptop's copy: the option built.
B. B. The same key, taught to the forms' own parser, so every playbook page of every repository may name an owner.
C. C. A visible owner line in the page's text, under its title, read by the settings pages only.

## What I had to decide

Whether the `owner:` line is a front-matter key of the settings page: a list of GitHub logins (a leading @ allowed), or `null` for the settings repository's `laws.owners`; a page without the line reads as `null`. The curated pages ship `owner: null`. The forms' parser (`kit/lib/playbook/forms.ts`) refuses unknown front-matter keys, so `readSettingsPage` in `kit/lib/omni-settings/page.ts` takes the line out of the front matter before the copy is written, the body kept byte for byte, and `ownersOf` falls back to the law owners. An owner line that names no login skips that page, named in the copy's record.

## What I did meanwhile

Nothing reads the owners yet but the page reader; s7 (the edit on the Omni page) is the first slice that will.

## What it costs to change later

A constant: moving the line into the page body or into the forms' own schema is a change to one reader before any settings repository holds pages.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's Q3 says an owner line defaulting to the law owners, and does not say where on the page it sits or whose law owners: the settings repository's, which is the repository the page lives in, is the option built.
- (author) Whether a page with no owner line should be refused rather than read as the law owners' is not settled; it is read, the more lenient choice.

```

<!-- /omni-outbox-settled: s1-02-owner-line -->

<!-- omni-outbox-settled: s1-03-templates-folder-test -->

## s1-03-templates-folder-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-templates-folder-test
prd: 2417
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

May this slice change an existing test outside its own area, the one that lists every file the kit ships as a default?

## The decision, in plain words

Yes, by one line: that test now also lists the four shared rules pages the kit ships, so it keeps refusing any other file.

## The intro, for fun

A guest list that says nobody else is coming meets four new guests at the door.

## The punchline, for fun

We added four names to the list instead of tearing it up.

## The options, in plain words

A. A. The test lists the curated pages beside the forms' templates: the option built.
B. B. The test leaves the omni-settings folder out of its list, and only the curated pages' own test names what it holds.
C. C. The curated pages move out of the templates folder into a folder the bundle carries on its own.

## What I had to decide

Whether `kit/lib/playbook/templates.test.ts`, outside the slice's territory, may list the curated pages: its test that the templates folder holds one template per form and the front door, and nothing else, now adds `omni-settings/playbook/<form>.md` for each of `CURATED_FORMS`. Without it the plan's own territory, `kit/templates/omni-settings/`, cannot hold a file and keep that test green.

## What I did meanwhile

The test still refuses any file it does not name; `kit/lib/omni-settings/curated.test.ts` also checks that the curated folder holds exactly those four pages.

## What it costs to change later

One line of one test; reverting it means moving the curated pages out of the kit's templates folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the territory but not this test, which any file added under the templates folder trips.

```

<!-- /omni-outbox-settled: s1-03-templates-folder-test -->

<!-- omni-outbox-settled: s3-01-settings-repo-when-none-named -->

## s3-01-settings-repo-when-none-named — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-settings-repo-when-none-named
prd: 2417
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

A workspace may have no plan repository on file. Which repository should then hold the workspace's shared tech playbook?

## The decision, in plain words

The page treats the workspace's plan repository as its settings repository. A workspace that names none gets an empty playbook and a line saying why, never an error.

## The intro, for fun

Every shared rulebook needs a shelf to sit on.

## The punchline, for fun

For now, workspaces without a plan repository simply have an empty shelf.

## The options, in plain words

A. A. Read the plan repository; none named means an empty playbook with a reason (built)
B. B. Add a settings repository setting on the workspace, falling back to the plan repository

## What I had to decide

Pick the repository to read when the workspace names no plan repository: a repository the workspace names for it, or the first repository it lists. Changing the choice is one function (settingsRepositoryOf) in the settings service.

## What I did meanwhile

A workspace with no plan repository reads the kit's first default, as before.

## What it costs to change later

Changing the choice later costs one small function and its test; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether workspaces should be able to name a settings repository apart from the plan repository (author)

```

<!-- /omni-outbox-settled: s3-01-settings-repo-when-none-named -->

<!-- omni-outbox-settled: s6-01-playbook-tab-nav -->

## s6-01-playbook-tab-nav — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-playbook-tab-nav
prd: 2417
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

Where does the new Playbook page appear in the settings menu, since the menu's own files are outside this slice?

## The decision, in plain words

The Playbook page shows itself as one more tab after Jev on its own page, and the other settings pages and the side menu do not list it yet.

## The intro, for fun

A new room is built, but the hallway signs belong to another crew.

## The punchline, for fun

So the room hangs its own sign until someone updates the hallway.

## The options, in plain words

A. A. The page carries its own Playbook tab; the shared menus are untouched (built).
B. B. Add Playbook to the shared settings tabs and the side menu in a later change.
C. C. Leave the page unlisted, reached by address only.

## What I had to decide

Whether to add Playbook to the settings tabs of the other pages and to the side menu (src/nav/section-tabs.ts, src/nav/sidebar.ts), outside this slice's territory.

## What I did meanwhile

The page builds its tab row from the settings tabs plus its own entry (PLAYBOOK_TABS in PlaybookScreen.tsx); moving the entry into the shared list is one line there.

## What it costs to change later

Until then, a member reaches the page only by its address or from the page itself.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the side menu's Settings entry should list Playbook (author)

```

<!-- /omni-outbox-settled: s6-01-playbook-tab-nav -->

<!-- omni-outbox-settled: s6-02-kit-default-in-deployment -->

## s6-02-kit-default-in-deployment — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-kit-default-in-deployment
prd: 2417
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

Will the kit's first default pages be present on the deployed Omni page, which reads them from files shipped with the kit?

## The decision, in plain words

The page reads the kit's first default from the kit's template files and, when they are not in the deployment, shows only the settings repository's own pages and logs why.

## The intro, for fun

The house rules are printed in a book that may not have been packed for the trip.

## The punchline, for fun

If the book is missing, the page shows what the repository wrote and says nothing rude about it.

## The options, in plain words

A. A. Fall back to the settings repository's pages alone, logging the failure (built).
B. B. Tell the app's build to ship the kit's first default files, in a later change.
C. C. Embed the first default's text in the Omni page's own code.

## What I had to decide

Whether the app's file tracing (apps/galaxy/next.config.ts outputFileTracingIncludes, outside this slice's territory) should include kit/templates/omni-settings so a deployment carries the kit's first default.

## What I did meanwhile

A failed read of the templates is caught in omni-settings-pages-live.ts and logged; the list then holds only the settings repository's pages.

## What it costs to change later

On a deployment without the templates, a page the settings repository lacks is not listed at all instead of marked as the kit's default.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Vercel build already traces kit/templates (author)

```

<!-- /omni-outbox-settled: s6-02-kit-default-in-deployment -->
