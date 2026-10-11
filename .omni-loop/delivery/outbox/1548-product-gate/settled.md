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

<!-- omni-outbox-settled: s2-01-two-changes-outside-the-slice -->

## s2-01-two-changes-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-two-changes-outside-the-slice
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

This slice was meant to change only the dossier and PRD commands and their routes. Two small changes outside it were needed: may they stay?

## The decision, in plain words

Yes, kept. The terminal's connection to the Omni page learned the four new calls a product PRD needs, and the help's own test now lists the new commands, so the help and its test agree.

## The intro, for fun

The new commands needed a phone line, and the phone book needed a new page.

## The punchline, for fun

We added both and wrote down who we called.

## The options, in plain words

A. A. Keep both changes in this slice (built).
B. B. Move the four new calls into a file of their own beside the dossier commands
C. C. Leave the new commands out of the help

## What I had to decide

Confirm the two changes outside the territory: four calls added to kit/lib/ask/client.ts (pushProductDossier, findProductDossier, getDossier, readProductApproval) and the help pin in kit/lib/help/entries.test.ts updated to the new usage lines of omni dossier and omni prd.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

kit/lib/ask/client.ts gained four calls beside pushDossier and findDossier: POST /api/dossiers/push with productKey, GET /api/dossiers?product=&prd=, GET /api/dossiers/get?product=&prd=&kind= and GET /api/dossiers/approval?prd=<key>-<n>. Nothing existing changed. kit/lib/help/entries.test.ts pins the dossier entry's usage list exactly; it now lists the three new lines, and a new test checks the product PRD wording of omni dossier and omni prd.

## What it costs to change later

Each is a few lines to move or undo. Without the client calls the kit cannot reach a product PRD; without the test change the help test is red.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists kit/lib/help/entries.ts but not its test, and no slice lists kit/lib/ask/client.ts, which every kit call to the Omni page goes through.

```

<!-- /omni-outbox-settled: s2-01-two-changes-outside-the-slice -->

<!-- omni-outbox-settled: s2-02-a-product-prd-approval-judged-by-the-server -->

## s2-02-a-product-prd-approval-judged-by-the-server — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-a-product-prd-approval-judged-by-the-server
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

A PRD that lives only on its product has no files in any checkout to compare with what was approved. When does its approval stop counting, as the terminal reads it?

## The decision, in plain words

The moment someone saves a changed version of an approved file, which the server already records. Nothing on anyone's computer is compared.

## The intro, for fun

An approval with no folder to check is like a receipt with no shopping bag.

## The punchline, for fun

So we asked the shop's own till, which never forgets a change.

## The options, in plain words

A. A. Judge by the server's voids, read from the approval route (built)
B. B. Also compare each pinned file with the latest version the get call returns

## What I had to decide

Confirm that omni prd mobile-12 judges a product PRD's approval by the server's voids alone (pending, drifted on a void, refused when the approver left, else approved), read from GET /api/dossiers/approval?prd=mobile-12, with its title, page and product read from GET /api/dossiers?product=&prd=.

## What I did meanwhile

kit/lib/approval/approval.ts gained judgeProductApproval and readProductApproval, sharing one judgment with the tree's, and productPrdState maps it to the stage as a ◆ PRD's inbox stage is mapped. The kit client calls the approval route with prd=<key>-<n> and the repository it runs from, as s3 taught that route. omni approval and omni wait approval still name a PRD by its number only.

## What it costs to change later

Comparing pinned hashes with the latest versions as well is one get call per pinned kind; the judgment's shape stays.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Every change to a product PRD's files goes through dossier_push, which voids on a changed pinned hash, so a void is the only drift a product PRD can have.
- (author) omni approval and omni wait approval on a product PRD are not in this slice's done-when; s12 is their first caller.

```

<!-- /omni-outbox-settled: s2-02-a-product-prd-approval-judged-by-the-server -->

<!-- omni-outbox-settled: s2-03-how-the-new-commands-take-and-give-files -->

## s2-03-how-the-new-commands-take-and-give-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-how-the-new-commands-take-and-give-files
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The new commands move a product PRD's files to and from the server. Where do they read the files to send, where do they write the ones they fetch, and what do they print?

## The decision, in plain words

Sending reads the PRD's files from a folder the command is pointed at, and fetching writes the file into a fresh folder outside every project, printing where it is and its fingerprint. The read-only view prints the file under a line saying its version and when it was read.

## The intro, for fun

Files without a home folder still need a front door and a mailbox.

## The punchline, for fun

The door is any folder you name, the mailbox a fresh one every time.

## The options, in plain words

A. A. A folder named with --from, a fresh scratch folder, a path then a sha256 line (built)
B. B. Read the files to send from the current folder, with no flag
C. C. Print the fetched file's content to the screen instead of writing a file

## What I had to decide

Confirm the shapes the skills will call in s11 and s12: omni dossier push --product <key> --new [--from <dir>] [--title] prints the new id, the link and the versions added; omni dossier push <key>-<n> --from <dir> pushes edits; omni dossier get <id> <kind> prints the scratch path then `sha256 <hash>`; omni prd <id> --show <kind> prints `<kind> of PRD <id> · v<k> · as of <time>`, a blank line, then the file; the last-read copy lives in .omni-loop/local/prd-cache/<id>/<kind>.json of the main checkout.

## What I did meanwhile

The files of --from are read by name (spec.md, plan.md, before-after.html, voice.json), the title from --title, else the spec's front matter, else (for a PRD already made) the title its page has. get writes under the system's temporary folder, in a new omni-<id>-* folder, checks the kit's own sha256 against the server's, keeps the last-read copy, and holds (exit 1) while the server is down; only --show answers from the copy, marked `· last-read copy, server unreachable`.

## What it costs to change later

Each shape is a line in one command and its tests; nothing stored depends on it but the last-read copies, which are a cache any change can drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the verbs and that they print a path and a hash, not the flags or the exact lines; s11 and s12 are their first callers.

```

<!-- /omni-outbox-settled: s2-03-how-the-new-commands-take-and-give-files -->

<!-- omni-outbox-settled: s2-04-the-prd-list-reads-a-repository-every-prd-had -->

## s2-04-the-prd-list-reads-a-repository-every-prd-had — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-the-prd-list-reads-a-repository-every-prd-had
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The page that lists every PRD, and a PRD's own page, still expect each PRD to have a home project. A PRD that lives only on its product has none: who teaches those pages, and before when?

## The decision, in plain words

Not this slice: it only taught the terminal and the routes it calls. The pages are left as they were, and a product PRD must not be created for real until a later slice teaches them.

## The intro, for fun

We built a new kind of guest, but the guest list still asks for a street address.

## The punchline, for fun

Nobody sends the invitation until the list learns to leave that line blank.

## The options, in plain words

A. A. Leave the pages to a later slice, before any product key is set (built)
B. B. Widen this slice to the PRD list and page now
C. C. Make the database leave product PRDs out of the list until the pages learn them

## What I had to decide

Name the slice that teaches the PRD list and the PRD page a product PRD (no home repository, no repository number, its name `mobile-12`), before any product key is set in production: s4, which owns DossierPage.tsx, or a new slice for apps/galaxy/src/dossier/page/history.ts and view.ts.

Decided by: Jev (hardToRevert 0.60) · agent said true

## What I did meanwhile

DossierRow.home_repo stays typed as text: making it nullable turns the typecheck red in apps/galaxy/src/dossier/page/history.ts and view.ts, outside this territory. history.ts's stageKeyOf calls home_repo.toLowerCase() on a dossier with no PRD number, which a product PRD is, so the list would throw on one. The dossier fake leaves a product PRD out of dossier_list(), and the product PRD calls of this slice read no page row. No product PRD can exist until an owner sets a product's key (product_set_key()), which no page offers yet.

## What it costs to change later

A guard in two page modules and their tests; nothing stored changes. Left undone, the PRD list breaks for a workspace the day its first product PRD is created.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice apps/galaxy/src/dossier/page/history.ts or view.ts; s1's item s1-03 named the dossier list among the readers s2 and s3 would teach, but neither territory holds it.

```

<!-- /omni-outbox-settled: s2-04-the-prd-list-reads-a-repository-every-prd-had -->

<!-- omni-outbox-settled: s3-01-the-app-reads-the-approval-itself -->

## s3-01-the-app-reads-the-approval-itself — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-the-app-reads-the-approval-itself
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The check on a target pull request needs to know whether the plan was approved. Should the GitHub App read that record from the database itself, or ask the web app for it?

## The decision, in plain words

The App reads it from the database itself, the way it already reads a repository's business, and only for a product that lists the pull request's repository. A pull request naming a PRD of a product that does not hold its repository learns nothing of it.

## The intro, for fun

The robot at the door needed to see the signed permission slip.

## The punchline, for fun

It walks to the filing cabinet itself, but only opens its own team's drawer.

## The options, in plain words

A. A. The App reads the record as the service role, scoped to products holding the repository (built).
B. B. A signed galaxy route reads it and the App calls that route.
C. C. A new database function for the App, like business_for_repo_app.

## What I had to decide

Confirm the App reads a product PRD's approval, voids and latest versions as the service role, scoped by product_repositories, rather than through a signed call to a galaxy route.

## What I did meanwhile

apps/omni-app/src/approved-check/record.ts reads product_repositories (joined on products.key), dossiers, dossier_versions, approvals, workspace_members and approval_voids with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, the pair the pr-stats collector and the canon gate already use. Without that pair every approved check is held (neutral). No galaxy route or new secret was added, so env.ts is unchanged.

## What it costs to change later

Moving the read behind a galaxy route is a new route, a shared secret and swapping one reader passed to createApprovedCheck; the check's judgement and tests stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists apps/galaxy/src/approval/ for this slice as 'reads the approval for the check', which hints at a galaxy route; dossier_approval() checks who calls, and the App has no person's session, so a route would itself need the service role.
- (author) No boundary file was added for these reads, so pnpm schemas:verify does not check their shapes against production.

```

<!-- /omni-outbox-settled: s3-01-the-app-reads-the-approval-itself -->

<!-- omni-outbox-settled: s3-02-a-check-for-no-approval-yet -->

## s3-02-a-check-for-no-approval-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-a-check-for-no-approval-yet
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The spec says what the approval check shows when the work matches, has drifted or cannot be read. What should it show when nobody approved the PRD yet, when the approver has left the workspace, or when the PRD named does not exist for this repository?

## The decision, in plain words

Each of those three shows a red check with its reason in a few words: waiting for approval, approver no longer a member, or no such PRD for this repository. Only an unreadable server shows the neutral, not-failed check.

## The intro, for fun

Three new ways to be not quite ready showed up at the gate.

## The punchline, for fun

All three get a polite red light, and only a power cut gets a shrug.

## The options, in plain words

A. A. Failure for pending, refused and unknown (built).
B. B. Neutral for unknown, failure for the other two.
C. C. Neutral for all three, as held.

## What I had to decide

Confirm failure for pending, refused and unknown, or ask for neutral on any of them.

## What I did meanwhile

approvedVerdict() in apps/omni-app/src/approved-check/state.ts posts failure with 'pending · mobile-12 waits for approval', 'refused · approver <login> is not a workspace member' and 'unknown · no product PRD mobile-12 holds this repository'; held stays neutral, as the spec asks. A drift is checked before the member tick, so a drifted PRD reads drifted.

## What it costs to change later

Each conclusion is one constant in approvedVerdict() and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names building, drifted and held only; acceptance 6 says nothing of a PRD not yet approved.
- (author) A required omni/approved check that fails on 'unknown' blocks a pull request whose body mistypes the PRD id until the body is fixed.

```

<!-- /omni-outbox-settled: s3-02-a-check-for-no-approval-yet -->

<!-- omni-outbox-settled: s3-03-one-test-outside-and-a-local-id-reader -->

## s3-03-one-test-outside-and-a-local-id-reader — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-one-test-outside-and-a-local-id-reader
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Adding the new check meant touching one test outside this slice's ground, and reading a product PRD's name before the slice that teaches the kit those names has landed. Are both acceptable?

## The decision, in plain words

Yes, kept small: the test that lists every function the App serves now lists the new one, and the check reads a name like mobile-12 with its own short reader until the kit's shared one lands.

## The intro, for fun

The new check arrived before its name tag printer did.

## The punchline, for fun

So it wrote its own name tag, in the same handwriting, for now.

## The options, in plain words

A. A. Keep the test change and the local reader until s2 lands (built).
B. B. Wait for s2 and use its parser in this slice before merging.

## What I had to decide

Confirm the change to apps/omni-app/src/outbox-check/inngest-route.test.ts, and that productPrdOf() in apps/omni-app/src/approved-check/state.ts is swapped for s2's kit/lib/ids parser once it lands.

## What I did meanwhile

inngest-route.test.ts lists APPROVED_FUNCTION_ID and counts 11 registered functions (7 served). productPrdOf() reads 'Part of <key>-<n>' with the key rule of 20261203090000_product_prd_ids.sql (lowercase kebab-case, each part starting with a letter, at most 40 characters). entries/inngest.ts still says it serves six functions; that file is s4's ground.

## What it costs to change later

Swapping the reader for the kit's is an import and a deleted regular expression; reverting the test change is three lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) kit/lib/ids is s2's territory and runs in parallel, so this slice could not use its parser.
- (author) The comment in apps/omni-app/entries/inngest.ts naming six functions is now stale.

```

<!-- /omni-outbox-settled: s3-03-one-test-outside-and-a-local-id-reader -->

<!-- omni-outbox-settled: s3-04-the-approval-route-takes-a-prd-id -->

## s3-04-the-approval-route-takes-a-prd-id — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-the-approval-route-takes-a-prd-id
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Approving a product PRD on its page, and reading its approval from the terminal, used to fail because such a PRD has no repository or issue. How should the web app name such a PRD when asked for its approval?

## The decision, in plain words

It takes the PRD's own name, like mobile-12, with the repository optional and only used to pick the workspace. Approving a product PRD works and labels no issue, since it has none.

## The intro, for fun

The approval desk only took forms with a street address on them.

## The punchline, for fun

Now it also takes a name and a product, no address needed.

## The options, in plain words

A. A. The PRD is named by its id, the repository optional (built).
B. B. The product key and the number are sent as two parameters.

## What I had to decide

Confirm GET /api/dossiers/approval?prd=<key>-<n>[&repo=<owner/name>] as the shape s2's kit reads a product PRD's approval with.

## What I did meanwhile

apps/galaxy/src/approval/approval-api.ts calls dossier_approval(p_repo, p_prd, p_product) for a product PRD id (p_repo empty when none is given), refuses an id out of shape by saying the PRD is a number or a product PRD's id like mobile-12, and after dossier_approve() answers repo and prd null with prdId, reads the approval in force by that id and labels nothing.

## What it costs to change later

Another parameter shape is a few lines in the route and its tests, and in s2's caller.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s2 builds the kit's reader in parallel; the two must agree on this query shape.
- (author) After approving, the PRD is re-read by its id with no repository hint, so a person in two workspaces sharing the key reads the oldest product's PRD (settled item s1-02).

```

<!-- /omni-outbox-settled: s3-04-the-approval-route-takes-a-prd-id -->

<!-- omni-outbox-settled: s4-01-the-server-event-reuses-the-stage-secret -->

## s4-01-the-server-event-reuses-the-stage-secret — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-the-server-event-reuses-the-stage-secret
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

The web app now tells the GitHub app when a product PRD is approved or its approval is voided. Which shared secret proves the message came from the web app, and where does it send it?

## The decision, in plain words

It signs with the secret the two apps already share for their stage messages, and sends to the GitHub app's production address, written into the web app. Nobody has to set anything new.

## The intro, for fun

Two apps already share one secret handshake, so we taught them a second move with it.

## The punchline, for fun

Same handshake, new dance, and no new key under the doormat.

## The options, in plain words

A. Reuse the stage events' secret and a fixed production address (built).
B. A secret of its own for server events, set in both apps.
C. Reuse the secret, but read the App's address from a new variable, defaulting to production.

## What I had to decide

Confirm reusing STAGE_EVENT_SECRET (galaxy and omni-app already share it, signing in the same x-omni-signature-256 header) for the new server event, and the fixed address https://omni-loop.vercel.app/api/server-event (app.yml's url) in apps/galaxy/src/server-event/server-event.service.ts, rather than a secret and an OMNI_APP_URL of its own.

## What I did meanwhile

galaxy signs { event, dossier, at } with an HMAC-SHA256 of the exact body under serverEnv().stageEventSecret and POSTs it to OMNI_APP_URL + /api/server-event; omni-app verifies it with env.stageEvents.secret and answers 401 to a bad or missing signature. Without the secret galaxy sends nothing and logs one line, and omni-app refuses every event. A preview of galaxy also posts to the production App.

## What it costs to change later

A secret of its own is a new group in both env.ts files, their README and .env.example lists, and a value set in both Vercel projects. An address variable is one group in galaxy's env.ts and its docs; the constant stays as its default.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the event is signed but not with which secret; the PRD, the registers and the glossary name no address for the App on galaxy's side, and galaxy's env.ts (outside this slice) has none.

```

<!-- /omni-outbox-settled: s4-01-the-server-event-reuses-the-stage-secret -->

<!-- omni-outbox-settled: s4-02-which-open-pull-requests-are-rechecked -->

## s4-02-which-open-pull-requests-are-rechecked — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-which-open-pull-requests-are-rechecked
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When a product PRD is approved or voided, the GitHub app re-checks the PRD's open pull requests without asking GitHub for a list. Which pull requests does it look at?

## The decision, in plain words

Every open pull request the web app last recorded in the product's repositories. The app reads each one once and re-checks only those whose description names the PRD.

## The intro, for fun

No list from GitHub means we go through our own notebook, page by page.

## The punchline, for fun

One quick peek per pull request, and only the ones wearing the PRD's name tag get re-checked.

## The options, in plain words

A. Every open recorded pull request of the product's repositories, each read once (built).
B. Only the open ones Omni-man signed, into the default branch.
C. Store each pull request's PRD when the collector reads it, and read no pull request at all.

## What I had to decide

Confirm the candidates are the rows of pull_requests (the prStats collector's, PRD 612) with neither merged_at nor closed_at, in every repository product_repositories lists for the PRD's product, in its workspace, each read with one GET of that pull request (its body and head) through the workspace's github_installation_id; or narrow it (signed only, base the default branch only) or widen it.

## What I did meanwhile

apps/omni-app/src/server-event/targets.ts reads dossiers, products, workspaces, product_repositories and pull_requests as the service role; apps/omni-app/src/server-event/recheck.ts reads each pull request once, keeps those whose body says Part of <key>-<n>, and sends one approved check event per kept pull request, which the approved check posts with its own verdict. A repository the collector does not track, or a pull request opened since its last 15-minute run, is not re-checked by the event; its next webhook posts the check.

## What it costs to change later

Narrowing or widening the candidates is one query in targets.ts. Reading the installation per repository instead of per workspace is one App call per repository.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the event lists target PRs from pull_requests, not which of them; pull_requests keeps no body, so which are a PRD's own can only be read from GitHub, one pull request at a time.

```

<!-- /omni-outbox-settled: s4-02-which-open-pull-requests-are-rechecked -->

<!-- omni-outbox-settled: s4-03-five-changes-outside-the-slice -->

## s4-03-five-changes-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-five-changes-outside-the-slice
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Building this needed small changes in files outside the slice's ground: may they stay?

## The decision, in plain words

Yes, kept. The GitHub app's new address needed its build list, its hosting settings and its test of served functions to name it, and the web app's push and PRD page needed one line each to send the void and show the approval card.

## The intro, for fun

The new message needed a door, a doorbell and a nameplate in the hallway.

## The punchline, for fun

We touched the hallway as little as we could and wrote down every fingerprint.

## The options, in plain words

A. Keep all five in this slice (built).
B. Move the galaxy wiring to a later slice, leaving the void unsent and the card unshown until then.

## What I had to decide

Confirm the five changes outside the territory: apps/omni-app/build.ts (server-event in FUNCTIONS), apps/omni-app/vercel.json (its maxDuration, which narrate.test.ts requires of every function), apps/omni-app/src/outbox-check/inngest-route.test.ts (the eighth function and twelve registered), apps/galaxy/src/dossier/api-live.ts (tellVoids wrapped by withAppTold) and apps/galaxy/src/dossier/page/DossierRoute.tsx (the attestation read on the product PRD path).

## What I did meanwhile

Each is a line or two. The new Vercel function's bundle, apps/omni-app/api/server-event.mjs, is generated and left to the wave's rebuild. The plan names apps/galaxy/layering/baseline.json, which does not exist: the baseline is layering/baseline.json at the root, and it needed no change since every new galaxy file follows its role.

## What it costs to change later

Each is a few lines to undo. Without the first three the new route is not served or its tests are red; without the last two the void is not sent and the page shows no attestation.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory has no entry for the App's build list, its Vercel settings or the dossier push and page wiring, which the done-when lines need.

```

<!-- /omni-outbox-settled: s4-03-five-changes-outside-the-slice -->

<!-- omni-outbox-settled: s4-04-restore-and-ask-again-are-links -->

## s4-04-restore-and-ask-again-are-links — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-restore-and-ask-again-are-links
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When a file changed after a product PRD was approved, its approval card offers to restore the approved file and to ask for the approval again. What do those two do?

## The decision, in plain words

Restore opens the approved version of that file on the PRD's page, so someone can send it again, and Ask again opens the approval screen; neither changes anything by itself.

## The intro, for fun

The card got two shiny buttons, and we had to decide how brave they are.

## The punchline, for fun

For now they open doors, they do not walk through them.

## The options, in plain words

A. Two links: the pinned version, and the approve screen (built).
B. Restore pushes the pinned version back; Ask again stays a link.
C. Both act: Restore pushes it back, Ask again asks the product's approvers.

## What I had to decide

Confirm Restore as a link to the pinned version on the page (?tab=<kind>&v=<n>) and Ask again as a link to the approve screen (#approve), or ask for Restore to push the pinned version back as a new version, and Ask again to send the approvers a new request.

## What I did meanwhile

apps/galaxy/src/dossier/page/Attestation.service.ts builds both hrefs; Attestation.tsx renders them as plain links. The approve screen got id=approve in DossierPage.tsx. A product PRD's page shows no approve screen yet (approvalView reads only a PRD with a number), so Ask again lands on the page top until it does.

## What it costs to change later

A restoring push is a new action and route in galaxy calling dossier_push with the pinned content; an asking request is a page call of the existing approval request route. Either replaces a link with a button: no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the before/after page name restore and ask again, never what each does; the page has no action today that pushes an old version back.

```

<!-- /omni-outbox-settled: s4-04-restore-and-ask-again-are-links -->

<!-- omni-outbox-settled: s5-01-an-item-takes-one-settlement -->

## s5-01-an-item-takes-one-settlement — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-an-item-takes-one-settlement
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Once a question of a product PRD has an answer, or was adopted when it was raised, can anyone record a second answer for it later, for instance to object to an adoption?

## The decision, in plain words

A question takes one answer and the server refuses any second one, as the spec asks; an objection to an adopted question has no place on the server yet.

## The intro, for fun

Every question gets one answer, and the server writes it in pen.

## The punchline, for fun

Second thoughts will need a fresh page we have not printed yet.

## The options, in plain words

A. A. One settlement per item, refused in the RPCs (built).
B. B. Let a drifted objection follow an adoption, and nothing else.
C. C. Let any later answer append, the latest one in force, as the git ledger reads.

## What I had to decide

Confirm that outbox_settle() and outbox_item_adopt() refuse an item that already has a settlement, even though the git ledger lets an objection append a drifted entry after an adoption.

## What I did meanwhile

The settlements table holds no uniqueness constraint: the refusal lives in the two RPCs, under the item's row lock, so allowing a later objection is a change to a function body, not to stored data. supabase/checks/outbox_items.sql proves a second settle is refused for an agreed and for an adopted item.

## What it costs to change later

Allowing an objection after an adoption is one condition in outbox_settle() and its check; no migration of rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Acceptance 9 says an item already settled cannot be settled again; the git outbox lets an objection append a drifted entry for an adopted item, and the spec does not say whether a product PRD keeps that path.

```

<!-- /omni-outbox-settled: s5-01-an-item-takes-one-settlement -->

<!-- omni-outbox-settled: s5-02-a-non-member-finds-no-prd -->

## s5-02-a-non-member-finds-no-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-a-non-member-finds-no-prd
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When someone outside a product's workspace tries to answer or raise one of its questions, should the server say they are not allowed, or that there is no such PRD?

## The decision, in plain words

It says there is no such PRD in their workspaces, the same answer as for a PRD that does not exist, so nobody learns what another workspace is building.

## The intro, for fun

A stranger knocks on a door that, as far as they can tell, is not there.

## The punchline, for fun

No door, no doorbell, no clue what is behind the wall.

## The options, in plain words

A. A. No such PRD, as for one that does not exist (built).
B. B. Not allowed, which tells them the PRD exists elsewhere.

## What I had to decide

Confirm that outbox_settle(), outbox_item_put() and outbox_item_adopt() refuse a non-member with P0002 'No PRD <key>-<n> in your workspaces.' rather than 42501.

## What I did meanwhile

The three RPCs find the PRD with prd_dossier(), which only looks among the caller's workspaces, as s1's approval_request() and dossier_push() do; a signed-out caller gets 42501. The check proves another workspace's owner and an account in no workspace are refused and write nothing.

## What it costs to change later

Answering 42501 instead is a lookup outside the caller's workspaces in outbox_prd_of(); no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Acceptance 9 says a non-member's answer is refused, not with what answer; s1 settled the same shape for approvals.

```

<!-- /omni-outbox-settled: s5-02-a-non-member-finds-no-prd -->

<!-- omni-outbox-settled: s5-03-the-workflow-runs-the-new-check -->

## s5-03-the-workflow-runs-the-new-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-the-workflow-runs-the-new-check
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

This slice was meant to touch only the database files. The new database check also had to be added to the automatic checks run on every pull request: may that one change stay?

## The decision, in plain words

Yes, kept. The database workflow now runs the new outbox check, as the repository's rules ask of every new check, the same change the first slice made for its own.

## The intro, for fun

A brand new test is no use if nobody ever sits it.

## The punchline, for fun

So we put its name on the exam timetable too.

## The options, in plain words

A. A. Keep the step in this slice (built).
B. B. Move it to a later slice and leave the check unrun until then.

## What I had to decide

Confirm the one change outside the territory: a step in .github/workflows/supabase.yml that runs supabase/checks/outbox_items.sql.

## What I did meanwhile

The step sits right after the product_prd_ids step, worded like its neighbours (conventions: a new database check runs in CI, PRD 902 s1-02).

## What it costs to change later

Five lines to remove; without them the check proves nothing in CI.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s5 does not list the workflow, and conventions require the step in the pull request that adds the check.

```

<!-- /omni-outbox-settled: s5-03-the-workflow-runs-the-new-check -->

<!-- omni-outbox-settled: s5-04-what-an-item-row-keeps -->

## s5-04-what-an-item-row-keeps — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-what-an-item-row-keeps
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Besides the question's text, what does the server keep about each question of a product PRD, and about each answer?

## The decision, in plain words

Each question keeps its name, its slice, its rank, what it bears on, when and in which wave it was raised, and the repository it came from. Each answer keeps its verdict, why, the words given, where and by whom, and who a question is for is read from its rank.

## The intro, for fun

A filing cabinet is only as good as the labels on its drawers.

## The punchline, for fun

We labelled seven drawers and left the rest in the folder itself.

## The options, in plain words

A. A. Front matter as columns, the repository, and the body as written (built).
B. B. Also store who the item is for as its own column.
C. C. Store only the body and parse it on every read.

## What I had to decide

Confirm the typed columns: outbox_items (item, slice, rank, bears_on, raised, wave, repository, body, raised_by) and outbox_settlements (verdict, basis, answer, channel questions or terminal, settled_by, settler_login), with no column for who an item is for.

## What I did meanwhile

The typed columns copy the item's front matter as the kit's one parser reads it; the body keeps the markdown as written, so the plain-words sections and the options stay in it. An adoption carries no answer and no channel, and settled_by is whoever raised it. The Questions tab (s9) can read who an item is for from its rank.

## What it costs to change later

A new column later is an additive migration; renaming or dropping one before any product PRD exists is a follow-up migration with no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the PRD, the repository and who it is for on the Questions tab, but not which of them the rows store; the git ledger's 'Approved by' is a login string, here it is the caller's account.

```

<!-- /omni-outbox-settled: s5-04-what-an-item-row-keeps -->

<!-- omni-outbox-settled: s6-01-the-store-holds-the-outbox-not-every-file -->

## s6-01-the-store-holds-the-outbox-not-every-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s6
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-the-store-holds-the-outbox-not-every-file
prd: 1548
slice: s6
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Every outbox command now reads and writes the outbox through one door. Must the files a command is handed or told to write, which are not the outbox, go through that door too?

## The decision, in plain words

Only the outbox itself goes through the door: the open questions, the ledger of answers and the accounts. A file a person hands a command, a result it is told to write, and the summary it leaves for the automated checks stay with the command, as before.

## The intro, for fun

One door now leads into the outbox, and every command was asked to use it.

## The punchline, for fun

The doormat and the post slot stayed where they were.

## The options, in plain words

A. A. Only the outbox goes through the door; a command's own input and output files stay with it (built).
B. B. Every file a command touches goes through the door, the outbox and the rest alike.
C. C. Leave the reading commands outside the door, and send only the writing ones through it.

## What I had to decide

Confirm the reading of the done-when line 'no outbox verb reads or writes the filesystem except through the store': the store owns outbox state (open items, settled.md, accounts, the --out scratch folder and the relay's source folder), while a verb's own arguments stay outside it — the --file JSON of item new, settle's --answer-file and answers' --answers (read through readUserFile), comment's --result, --pr-comment and --slack-note files, and status's GITHUB_OUTPUT and step summary.

## What I did meanwhile

kit/lib/outbox/store.ts defines OutboxStore; kit/lib/outbox/git-store.ts holds every outbox read and write the commands made (adopt's read and rmSync of the item, item new's spent ids and item file, the relay's folder check). kit/lib/outbox/git-store.test.ts guards it: item, adopt, settle, answers and replies import nothing from node:fs, status only appendFileSync (the Actions output) and comment only writeFileSync (--result), and none imports a library function the store wraps.

## What it costs to change later

Moving a verb's own files behind the store is a method or two on OutboxStore and a line in the guard per file; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan say every outbox verb is on the seam but not whether a verb's input and output files count as the outbox.
- (author) A server store has no use for a person's input file or the Actions output, which is why they stayed with the command.

```

<!-- /omni-outbox-settled: s6-01-the-store-holds-the-outbox-not-every-file -->

<!-- omni-outbox-settled: s6-02-the-git-store-wraps-the-library-in-place -->

## s6-02-the-git-store-wraps-the-library-in-place — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s6
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-the-git-store-wraps-the-library-in-place
prd: 1548
slice: s6
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The outbox kept in the repository now sits behind one door. Should the code that reads and writes those files physically move behind the door, or stay where it was with the door calling it?

## The decision, in plain words

The code stays where it was and the door calls it, so every existing test runs untouched. The door offers whole tasks, like grading the gate or writing the comment, which the next slice builds again for the outbox kept on the server.

## The intro, for fun

We built a new front door and had to decide whether to carry the furniture through it.

## The punchline, for fun

The furniture stayed put; the door just learned where everything is.

## The options, in plain words

A. A. The door calls the code where it is, and offers whole tasks (built).
B. B. Move the file reading and writing out of the library into the door, rewriting the tests that call it.
C. C. Offer only raw reads and writes at the door, and run the gate and the comments above it for both outboxes.

## What I had to decide

Confirm the shape of the seam: gitOutboxStore wraps settleItem, adoptItem, relayFolder, gateResult, openItemsForPrd, adoptedEntriesForPrd, readReplies and the two comment upserts in place, with async methods at the level of a verb (gate, replies, prComment, issueComment) beside the item reads and writes; an item reference is a repository path for git; outboxStore(ctx) in kit/lib/outbox/stores.ts returns the git store for every PRD, and s7 adds the pick by birthplace there and its server store as a second row of the contract suite in kit/lib/outbox/store.contract.test.ts.

## What I did meanwhile

Acceptance 5 asks every existing test in kit/lib/outbox and of the moved commands to pass unchanged; they import the library functions directly, so the library keeps its signatures and its file access. The commands now call only the store. The contract suite runs twelve cases through the store's methods alone; git-store.test.ts covers the git store's own ground.

## What it costs to change later

Moving the file access out of the library later is a refactor of each wrapped function and its tests, behind the same interface; switching to raw reads and writes changes the interface s7 builds on, so it is cheapest decided before s7 starts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the git store is today's code moved but not whether moved means relocated or put behind the seam.
- (author) Verb-level methods mean the server store must grade the gate and write comments itself; s7 may prefer to make gateResult pure over rows instead.

```

<!-- /omni-outbox-settled: s6-02-the-git-store-wraps-the-library-in-place -->

<!-- omni-outbox-settled: s7-01-a-product-item-names-its-prd -->

## s7-01-a-product-item-names-its-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-a-product-item-names-its-prd
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

How does a question of a product PRD say which PRD it belongs to, and how does someone point at one to settle it?

## The decision, in plain words

A question names its product PRD the way people write it, like mobile-12, in the same place a repository's question writes its number. To settle or adopt one, you give its name and the PRD, since there is no file to point at.

## The intro, for fun

A question with no file still needs an address on its door.

## The punchline, for fun

So it got one: the PRD's name, a slash, and its own name.

## The options, in plain words

A. Name the product PRD in the question's text, and a question by its PRD and its own name, the option built.
B. Keep a number in the question's text and let the stored row alone say which product PRD it is.
C. Name a question by its own name only, and look up which PRD holds it.

## What I had to decide

Which PRD a stored question belongs to, in the question's own text, and how the terminal names one question of a product PRD.

## What I did meanwhile

The question's text names the product PRD by its name, which the one reader of questions now accepts beside a number, and a question is named by its PRD and its own name together.

## What it costs to change later

Before any product PRD exists, a constant and the reader; after, the stored questions would have to be rewritten.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page that lists questions, in a later slice, wants another way to name one.

```

<!-- /omni-outbox-settled: s7-01-a-product-item-names-its-prd -->

<!-- omni-outbox-settled: s7-02-a-terminal-answer-is-the-signed-in-persons -->

## s7-02-a-terminal-answer-is-the-signed-in-persons — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-a-terminal-answer-is-the-signed-in-persons
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When an answer to a product PRD's question is typed in the terminal, who does the record say gave it, and where?

## The decision, in plain words

The record says it was answered in the terminal, by whoever is signed in. Who approved it and when can still be given, and are checked as before, but the server keeps its own name and time.

## The intro, for fun

The terminal does not know who is typing, but the sign-in does.

## The punchline, for fun

So the sign-in signs for it.

## The options, in plain words

A. The signed-in person, in the terminal, the option built.
B. Keep the name and time given by hand beside the signed-in person.
C. Refuse an answer that does not say who gave it.

## What I had to decide

What an answer given through the terminal records on the server: its channel, and who and when.

## What I did meanwhile

The channel is the terminal, the person is the one signed in and the time is when it was saved; a name or a time given by hand is checked, then left to the server's own record.

## What it costs to change later

One small change on the server's record if a hand-given name must be kept too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an agent relaying a person's answer should record that person rather than itself.

```

<!-- /omni-outbox-settled: s7-02-a-terminal-answer-is-the-signed-in-persons -->

<!-- omni-outbox-settled: s7-03-the-server-outbox-counts-open-questions-only -->

## s7-03-the-server-outbox-counts-open-questions-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-the-server-outbox-counts-open-questions-only
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

What does the gate of a product PRD look at, now that its questions live on the server?

## The decision, in plain words

Only the questions still open. A question answered with a change does not hold the gate until the change is made, the server keeps no account of risky changes yet, so one handed over stays where it was, and nothing is posted on GitHub: answers come from the Questions tab or the terminal.

## The intro, for fun

The server's outbox is younger than the one in the repository, and it shows.

## The punchline, for fun

It knows open from answered, and that is all it knows so far.

## The options, in plain words

A. Count open questions only, refuse accounts, post nothing, the option built.
B. Also hold the gate on every answer that asked for a change until someone marks it reworked.
C. Keep accounts and changed answers in the repository beside the questions on the server.

## What I had to decide

Which of the checks the repository's gate makes also hold a product PRD's gate.

## What I did meanwhile

The gate is green when no question is open or a person waved it through; a handed-over account is refused with its reason and left in its folder; the comments and the replies on GitHub do nothing for a product PRD.

## What it costs to change later

Adding each missing check later is its own change on the server and in the kit, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later slice gives the server a place for accounts and for the rework of a changed answer.

```

<!-- /omni-outbox-settled: s7-03-the-server-outbox-counts-open-questions-only -->

<!-- omni-outbox-settled: s7-04-a-product-prds-questions-are-numbered-afresh -->

## s7-04-a-product-prds-questions-are-numbered-afresh — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-04-a-product-prds-questions-are-numbered-afresh
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

How are a product PRD's questions numbered when someone answers them in the terminal, with no pull request comment to keep the numbers?

## The decision, in plain words

Each time, the open questions are numbered from one, the most pressing first, as the comment would list them, and the picks settle them on the server straight away.

## The intro, for fun

Without a comment to remember the numbers, the numbers have to be worked out again.

## The punchline, for fun

Luckily, counting from one is a well known skill.

## The options, in plain words

A. Number afresh each time and settle at once, the option built.
B. Keep each question's number on the server, so it never moves.
C. Answer by the question's name instead of a number.

## What I had to decide

Where the numbers of a product PRD's questions come from, and what answering them does.

## What I did meanwhile

The numbers are worked out from the open questions on every call; answering settles each one at once; printing the reply instead is refused, and the switch that turns the terminal door off is not read for a product PRD.

## What it costs to change later

Keeping numbers on the server would be a small new column and one change here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether two people answering at once could see the numbers move between asking and answering.

```

<!-- /omni-outbox-settled: s7-04-a-product-prds-questions-are-numbered-afresh -->

<!-- omni-outbox-settled: s7-05-held-since-the-call-that-failed -->

## s7-05-held-since-the-call-that-failed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-05-held-since-the-call-that-failed
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When the server cannot be reached, since when does the terminal say it has been unreachable?

## The decision, in plain words

Since the call that just failed: the terminal keeps no memory of an earlier failure, so the time is now.

## The intro, for fun

Held since when is an easy question with an awkward answer.

## The punchline, for fun

Since just now, every time.

## The options, in plain words

A. The time of the failed call, the option built.
B. The time of the first failure in a row, kept on this computer until a call works.

## What I had to decide

The time the held line names.

## What I did meanwhile

The time of the failed call, printed in the held line, and the command exits as held, not failed.

## What it costs to change later

Remembering the first failure would be a small local note and one change here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page's own held line, in a later slice, wants the two times to agree.

```

<!-- /omni-outbox-settled: s7-05-held-since-the-call-that-failed -->

<!-- omni-outbox-settled: s7-06-changes-outside-the-slice -->

## s7-06-changes-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-06-changes-outside-the-slice
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

This slice changed a few places outside the area it was given. Are those changes all right to keep?

## The decision, in plain words

Yes, kept, each as small as it could be: the terminal commands that answer and record questions learned to name a product PRD and to sign in, the terminal's connection to the Omni page learned the three new calls, the help names the new forms, the reader of questions accepts a product PRD's name, and the tests got a stand-in for the new routes.

## The intro, for fun

The slice was told to stay in its garden, and it mostly did.

## The punchline, for fun

It only borrowed a few tools from the shed next door.

## The options, in plain words

A. Keep the changes, the option built.
B. Move the command changes into a slice of their own.

## What I had to decide

Whether the commands, the connection to the Omni page, the help, the question reader and a test helper may change for this slice.

## What I did meanwhile

Each one changed only as far as a product PRD needs; every command and question of a repository's PRD reads and writes exactly as before, and its tests pass unchanged.

## What it costs to change later

Each change undoes on its own, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan should have listed the commands in this slice's area.

```

<!-- /omni-outbox-settled: s7-06-changes-outside-the-slice -->

<!-- omni-outbox-settled: s8-01-two-wiring-lines-outside-the-slice -->

## s8-01-two-wiring-lines-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s8
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-two-wiring-lines-outside-the-slice
prd: 1548
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

This slice changed two places outside the area it was given, one line each, to switch on what it built. Are those changes all right to keep?

## The decision, in plain words

Yes, kept. The GitHub app's list of served functions now hands the outbox check its reader of the server and the Omni page's address, and the web app's outbox routes now tell the GitHub app after each question raised or answered.

## The intro, for fun

The slice built two new doorbells and had to run a wire through the neighbour's wall.

## The punchline, for fun

It drilled exactly two holes and swept up after itself.

## The options, in plain words

A. Keep the two lines, the option built.
B. Move the wiring into a slice of its own.

## What I had to decide

Whether the GitHub app's list of served functions and the web app's outbox routes may change for this slice, which built what they switch on.

## What I did meanwhile

Each place changed by one line: without the server set up, the outbox check of a product PRD is held, as the approved check is; every other check and route answers exactly as before, and their tests pass unchanged.

## What it costs to change later

Each line undoes on its own, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan should have listed the two wiring files in this slice's area; the plan names them in no slice of this landing.

```

<!-- /omni-outbox-settled: s8-01-two-wiring-lines-outside-the-slice -->

<!-- omni-outbox-settled: s8-02-the-product-outbox-check-holds-when-unread -->

## s8-02-the-product-outbox-check-holds-when-unread — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s8
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-the-product-outbox-check-holds-when-unread
prd: 1548
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

What does the outbox check on a product PRD's pull request show when the server cannot be read, when the PRD named is not one of this repository's product, or when the check itself fails?

## The decision, in plain words

An unreadable server shows held, not failed, as the approval check does, while a PRD this repository's product does not have, or a run that failed after its retries, shows red with the reason, since this check is the gate. Its details open the product's Questions tab, and it posts no comment.

## The intro, for fun

Every gate needs a plan for the day the keyholder is out to lunch.

## The punchline, for fun

Ours waits politely at the door instead of slamming it shut.

## The options, in plain words

A. Held when unread, red for an unknown PRD or a failed run (built).
B. Red whenever the server cannot be read.
C. Skipped when the server cannot be read, so it neither passes nor blocks.

## What I had to decide

How the product PRD's outbox check reads when the server is out of reach, when the PRD is not this repository's, and when its own run fails.

## What I did meanwhile

Built as described; a repository's own PRD and a plan repository's target pull request read exactly as before.

## What it costs to change later

Each reading is one line of the check's verdict, changed without touching any stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the open and the clear readings only; the held, unknown and failed readings follow the approval check's settled answers rather than anything said of the outbox check itself.

```

<!-- /omni-outbox-settled: s8-02-the-product-outbox-check-holds-when-unread -->

<!-- omni-outbox-settled: s8-03-two-new-server-event-kinds -->

## s8-03-two-new-server-event-kinds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s8
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-03-two-new-server-event-kinds
prd: 1548
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

How does the web app tell the GitHub app that a question of a product PRD was raised or answered, so both checks on its pull requests follow?

## The decision, in plain words

Through the same signed message the approval already sends, with two new kinds, a question opened and a question settled (an adoption counts as settled), naming the PRD's own record. The GitHub app then runs every check a push would run again on each open pull request of that PRD, so both checks follow, and the third check, on a PRD's design files, runs again too.

## The intro, for fun

The two apps already pass notes, so we added two new words to their secret language.

## The punchline, for fun

Opened and settled: short enough to whisper, clear enough to act on.

## The options, in plain words

A. Two new kinds, opened and settled, on the same message (built).
B. One kind for any change to the outbox.
C. Name the PRD by its short name rather than its record.
D. A message of its own that runs only the two checks, which changes a test that proves a rule of the gate.

## What I had to decide

The names of the two new kinds of message, what each one carries, and which checks a message posts again.

## What I did meanwhile

Built as described. The answer screen built beside this slice can send the settled kind the same way once it settles a question.

## What it costs to change later

Renaming a kind is a constant on each side, sent and read in the same release.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an adoption should rather send a kind of its own; it holds no question open, so it changes nothing a check shows unless it closes one already open.
- (author) Running the design-files check again costs a few more GitHub calls per pull request; a message of its own would avoid that, but it changes the test that proves how the gate reads its settings, which takes a question ranked high.

```

<!-- /omni-outbox-settled: s8-03-two-new-server-event-kinds -->

<!-- omni-outbox-settled: s9-01-an-unclear-answer-is-refused -->

## s9-01-an-unclear-answer-is-refused — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s9
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-an-unclear-answer-is-refused
prd: 1548
slice: s9
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When someone writes their own answer on the Questions tab and it says neither yes nor what to change, what happens to the question?

## The decision, in plain words

The answer is not saved and the person is asked to start with yes, say what to change, or add a line saying agreed or drifted, the same rule the terminal uses. Nothing is guessed.

## The intro, for fun

Some answers are a shrug typed out in full sentences.

## The punchline, for fun

We hand the shrug back and ask for a nod or a shake.

## The options, in plain words

A. Refuse it with a hint and keep the question open, as the terminal does (built).
B. Settle it as a change to what was built, since a wrong change only costs a rework question.
C. Ask the person to pick keep or change with two buttons beside their answer.

## What I had to decide

How the Questions tab reads an answer a person writes in their own words, when the kit's answer rules cannot tell whether it keeps or changes what was built.

## What I did meanwhile

The tab reads every answer with the kit's own rules: a letter is that option, A agrees and any other drifts; a written answer is judged as the terminal judges one, and one it cannot read is refused with a hint, the question staying open.

## What it costs to change later

A constant and one branch in the tab's service: settling such an answer as drifted, or adding two buttons for agreed and drifted, is a small change with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says an answer settles the item, but not what a written answer that reads neither way should do.

```

<!-- /omni-outbox-settled: s9-01-an-unclear-answer-is-refused -->

<!-- omni-outbox-settled: s9-02-who-a-question-is-for -->

## s9-02-who-a-question-is-for — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s9
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-who-a-question-is-for
prd: 1548
slice: s9
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Each question on the Questions tab says who it is for. Who is that?

## The decision, in plain words

A question that asks a person to do something is for whoever can do it. Every other question is for the person who opened its PRD: it says for you, or their GitHub name, or its author when the name is unknown.

## The intro, for fun

Every question deserves to know whose desk it lands on.

## The punchline, for fun

Mostly the desk of whoever started the whole thing.

## The options, in plain words

A. Actions for whoever can do them, the rest for the PRD's author (built).
B. Every question for the PRD's author.
C. Every question for the product's approvers.

## What I had to decide

Who a question is for, which the spec asks the tab to show and an earlier decision said is read from its rank.

## What I did meanwhile

Read from the rank: a human-action item is for a person who can do it; a high or medium one is for its PRD's author, named by their GitHub login from the workspace's players, or for you when you opened it.

## What it costs to change later

One small function on the product home's service: naming the product's approvers instead, or another rule, changes no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the earlier decision say who it is for is read from the rank, but not which person each rank points at.

```

<!-- /omni-outbox-settled: s9-02-who-a-question-is-for -->

<!-- omni-outbox-settled: s9-03-every-open-question-is-listed -->

## s9-03-every-open-question-is-listed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s9
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-03-every-open-question-is-listed
prd: 1548
slice: s9
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Which questions of a product's PRDs does the Questions tab list: only the pressing ones, or every one still open?

## The decision, in plain words

Every question still open, the most pressing first within each PRD, so the tab lists exactly what holds the gate. For a PRD kept in a repository, the tab still lists only the questions waiting on a person and links to its PRD page, as before.

## The intro, for fun

A to-do list that hides some to-dos is just a nicer-looking worry.

## The punchline, for fun

So this one shows them all, worst on top.

## The options, in plain words

A. Every open question of a product PRD, worst first (built).
B. Only the high and human-action ones, as for a repository's PRD.

## What I had to decide

Whether the tab lists the medium questions of a product PRD that are still open, or only the high and human-action ones as it does for a repository's PRD.

## What I did meanwhile

Lists every open row of a product PRD, sorted worst first as the outbox comment would number them, since the gate counts every open row; a repository PRD's questions are read and linked as before.

## What it costs to change later

A filter in the product home's service: hiding the open medium questions is one line, nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says every open question; the repository PRDs' list counts only those waiting on a person.

```

<!-- /omni-outbox-settled: s9-03-every-open-question-is-listed -->

<!-- omni-outbox-settled: s9-04-the-tab-settles-and-tells-the-app-itself -->

## s9-04-the-tab-settles-and-tells-the-app-itself — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-10-11T13:28:45Z
- Channel: feature pull request #1552
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1552#issuecomment-6109528023
- Basis: stated — the answer is settled as "drifted" because a human said so, not because a comparison read it
- Closed: yes — reworked by #1602, the sub-pull request that brought the build back in line
- Rank: high
- Bears on: ADR-0095
- Raised: 2026-10-11
- Slice: s9
- Wave: 3
- Stays here: a build choice for this PRD (one settle path through the outbox service, which records the channel); the rework brings the code in line, and nothing new is true about the product

### The answer, as it was given

```text
B. Teach the outbox's own service where an answer came from, and settle through it.
```

### The item, as it was raised

```text
---
id: s9-04-the-tab-settles-and-tells-the-app-itself
prd: 1548
slice: s9
rank: high
bears-on: ADR-0095
raised: 2026-10-11
wave: 3
---

## The question, in plain words

An answer on the Questions tab is saved by the tab's own small storage step rather than the outbox's own answer route. Is that all right?

## The decision, in plain words

Yes: the tab reads the question through the outbox's own service, saves the answer itself so it is recorded as given on the Questions tab, and then tells the GitHub app, the same message the outbox's own answer route sends.

## The intro, for fun

Two doors into the same room, each with its own doormat.

## The punchline, for fun

Both ring the same bell once you are in.

## The options, in plain words

A. The tab saves through its own step and tells the app itself (built).
B. Teach the outbox's own service where an answer came from, and settle through it.

## What I had to decide

How the tab saves an answer: the outbox's own service records every answer as given in the terminal, and changing it lies outside this slice.

## What I did meanwhile

A storage step of the tab's own calls the same database function with the Questions tab as where it was answered; after it, the tab's live wiring sends the item-settled event through the server-event sender, without changing any file outside the slice.

## What it costs to change later

Folding it into the outbox's service later is a refactor of two small files; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says to reuse the outbox's service; its settle has no way to say the answer came from the Questions tab.

```

<!-- /omni-outbox-settled: s9-04-the-tab-settles-and-tells-the-app-itself -->
