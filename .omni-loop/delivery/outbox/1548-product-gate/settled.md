# Settled outbox items — PRD 1548

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-only-an-owner-sets-a-product-key -->

## s1-01-only-an-owner-sets-a-product-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-only-an-owner-sets-a-product-key
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Who may give a product its short key, the word that starts every one of its PRD names, and can it ever change?

## The decision, in plain words

Only an owner of the workspace sets a product's key, once. After that nobody changes it, not even an owner, because every PRD name of that product is built from it.

## The intro, for fun

A product gets one short name tag for life, so someone has to hold the pen.

## The punchline, for fun

We handed the pen to the owners and glued the cap on.

## The options, in plain words

A. A. Only an owner sets a key, once (built).
B. B. Any member of the workspace sets it, once.
C. C. An owner may change it while the product has no PRD yet.

## What I had to decide

Confirm that setting a product's key is an owner's act, as changing a product's repositories is, rather than any member's, as renaming a product is.

## What I did meanwhile

product_set_key() calls product_repository_owned(), so a member who is no owner gets 42501. The key is checked against lowercase kebab-case (each part starting with a letter, at most 40 characters), unique in the workspace, and the products_key_once trigger refuses any change once set, even by the table owner.

## What it costs to change later

Widening it to any member is one line in product_set_key() (business_member_only instead of product_repository_owned). Letting a key change would orphan every product PRD id already handed out, so the set-once rule is the one to keep.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the key is set once on the product but not by whom; owner was the narrower choice.
- (author) No page sets a key yet: s2's push and later slices need one set, by an owner, before a product PRD exists.

```

<!-- /omni-outbox-settled: s1-01-only-an-owner-sets-a-product-key -->

<!-- omni-outbox-settled: s1-02-a-key-two-workspaces-share -->

## s1-02-a-key-two-workspaces-share — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-a-key-two-workspaces-share
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

A product's key is unique inside its workspace only. When a person belongs to two workspaces that both have a product with the same key, which one does a PRD name like mobile-12 mean?

## The decision, in plain words

The workspace that lists the repository the command runs from wins, or the one that owns its organisation; failing that, the oldest product with that key. Nothing is refused.

## The intro, for fun

Two workspaces, two products, one short name, one confused terminal.

## The punchline, for fun

The terminal asks the repository where it lives and settles the tie.

## The options, in plain words

A. A. The repository's workspace first, then the oldest product (built).
B. B. Refuse the name and ask for the workspace when two hold the key.
C. C. Make product keys unique across every workspace.

## What I had to decide

Confirm the tie-break, or ask that the server refuse the ambiguous name and make the person say which workspace.

## What I did meanwhile

product_of_key(key, repo) ranks the caller's products with that key by whether their workspace lists repo (or owns its owner), then by age. dossier_push() passes p_repo to it, and prd_dossier() (behind dossier_approval() and approval_request()) does the same, so the kit sending its checkout's repository picks the right one.

## What it costs to change later

Refusing instead is a raise in product_of_key() when two rows tie on the first rank; no stored data changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keys a product PRD by product key and counter and says nothing of a person in two workspaces sharing a key.

```

<!-- /omni-outbox-settled: s1-02-a-key-two-workspaces-share -->

<!-- omni-outbox-settled: s1-03-two-changes-outside-the-database-files -->

## s1-03-two-changes-outside-the-database-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-two-changes-outside-the-database-files
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

This slice was meant to touch only the database. Two small changes outside it were needed for the work to build and be checked: may they stay?

## The decision, in plain words

Yes, kept. The web app's outbox sending now skips a PRD that has no repository, so the app still compiles once the repository became optional, and the database workflow runs the new check, as the repository's rules ask of every new check.

## The intro, for fun

The database learned a new trick and two neighbours had to move their chairs.

## The punchline, for fun

One chair now skips the new guest, the other watches it every time.

## The options, in plain words

A. A. Keep both changes in this slice (built).
B. B. Move the galaxy guard to s2 and leave the typecheck red until then.
C. C. Keep the dossier's repository required and give a product PRD a stand-in repository.

## What I had to decide

Confirm both changes outside the territory: the guard in apps/galaxy/src/outbox/send-live.ts and the new step in .github/workflows/supabase.yml.

## What I did meanwhile

dossiers.home_repo became nullable, so the generated types made apps/galaxy/src/outbox/send-live.ts fail the typecheck. sendTargetOf() now answers no target for a dossier with no home repository, and repositoryPrd() makes the recount skip it; a dossier of a repository reads as before. The supabase workflow gained the step that runs supabase/checks/product_prd_ids.sql (conventions: a new database check runs in CI).

## What it costs to change later

Each is a few lines to undo. Without the guard the galaxy typecheck is red; without the step the new check proves nothing in CI.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Other galaxy readers parse a dossier's repository as text and would refuse a product PRD row (the dossier list, the approval bell, the request route); none is typed against the database, so the typecheck does not show them. They belong to s2 and s3.

```

<!-- /omni-outbox-settled: s1-03-two-changes-outside-the-database-files -->

<!-- omni-outbox-settled: s1-04-the-down-script-is-a-guarded-follow-up -->

## s1-04-the-down-script-is-a-guarded-follow-up — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-the-down-script-is-a-guarded-follow-up
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Undoing this database change would lose every product PRD's name. How should the undo refuse while any product PRD exists?

## The decision, in plain words

The undo is a later change, as for every other database change here, and its first step is a check kept in the database now that refuses while any product PRD exists. The check is tested both ways.

## The intro, for fun

Every good trapdoor needs a sign saying whether someone is standing on it.

## The punchline, for fun

The sign is installed now, and it shouts if anyone is.

## The options, in plain words

A. A. A guard function now, the follow-up migration written when needed (built).
B. B. A full down script kept beside the migrations, starting with the guard.

## What I had to decide

Confirm that the down script is the follow-up migration the header of 20261203090000_product_prd_ids.sql describes, opened by `select public.product_prd_ids_rollback_guard();`, rather than a down file kept in the repository.

## What I did meanwhile

product_prd_ids_rollback_guard() raises 55000 naming how many product PRDs exist; supabase/checks/product_prd_ids.sql proves it refuses with one and passes with none. The migration's Rollback comment lists everything the follow-up restores and drops.

## What it costs to change later

A down file of its own would be a second copy of four function bodies to keep in step; the guard is one function to drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The repository keeps no down files: every migration states its rollback as a follow-up migration, so the guard follows that convention.

```

<!-- /omni-outbox-settled: s1-04-the-down-script-is-a-guarded-follow-up -->

<!-- omni-outbox-settled: s1-05-a-product-prd-answers-with-its-name -->

## s1-05-a-product-prd-answers-with-its-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-a-product-prd-answers-with-its-name
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When the server answers about a product PRD, which has no repository and no repository number, what does it say in their place?

## The decision, in plain words

It leaves the repository and the number empty and adds the PRD's own name, like mobile-12. Answers about a PRD of a repository stay exactly as they were.

## The intro, for fun

A PRD with no home address still needs something written on the envelope.

## The punchline, for fun

We wrote its full name and left the street blank.

## The options, in plain words

A. A. Empty repository and number, plus the PRD's name, for a product PRD only (built).
B. B. Always answer the PRD's name, for every PRD, as text.
C. C. Answer the product's key and the number as two fields.

## What I had to decide

Confirm the answer shape the kit and the apps read in s2 and s3: repo and prd null, and prdId `<key>-<n>`, added only for a product PRD.

## What I did meanwhile

dossier_push(), dossier_approve() and approval_request() append prdId for a product PRD only, so every existing answer, and every existing check comparing one whole, is unchanged. dossier_approval() answers as before. Readers that parse repo as text will refuse a product PRD's answer until s2 and s3 teach them the new shape.

## What it costs to change later

Renaming or reshaping the field is a change in three function bodies and their readers, before any product PRD exists.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the RPCs take either key but not what they answer about a product PRD.

```

<!-- /omni-outbox-settled: s1-05-a-product-prd-answers-with-its-name -->
