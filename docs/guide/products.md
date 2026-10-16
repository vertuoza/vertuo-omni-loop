---
title: Products
description: Products are optional — a repository in no product, one or several, a PRD's own product, the product home on the Omni page, a product PRD built across repositories with no plan repository, and a plan repository reading its targets from a product.
---

A **product** is what your company sells or runs, such as *Mobile* or *Estimates*, kept on the Omni
page. It gathers the repositories it is built from and the PRDs, ideas and fixes made for it, and it
decides who approves its PRDs. This page shows how products and repositories link, how a PRD gets
its product, the product's own page, its **product home**, and a **product PRD**: one feature built
across the product's repositories with no plan repository.

## Products are optional

Nothing the loop does needs a product. A repository can be in **no product, one, or several**, and a
PRD has one product or none. A workspace with no product at all brainstorms, builds and ships exactly
as the rest of this guide shows, and nobody is asked about products.

A product adds three things:

- **a home**: one page that shows what waits on whom across the product's PRDs, and lists its ideas,
  roadmaps, fixes and questions;
- **approvers**: the members asked to approve its PRDs. With no product, any member of the workspace
  approves, as before;
- **a shared voice**: the product's claims and personas, which its PRDs are written for.

A new repository is in no product. Products are made, renamed and deleted under
**Settings › Products** on the Omni page, where each one keeps its Pitch settings too.

## A repository in several products

Products and repositories link **many to many**: a service shared between two products, such as an
API both apps call, is linked to each of them, and both list it. Each link holds what the product
knows about that repository:

| field | what it says |
|---|---|
| **role** | one word for what the repository does in this product: `api`, `web`, `mobile` |
| **knowledge** | where its knowledge lives: `own`, `imported` or `none` |
| **read at** | the commit an imported knowledge base was read at |
| **read-only** | the product reads this repository but never changes it |
| **consumes** | the product's other repositories whose packages this one installs |

The same repository can hold a different role in each product. A repository never consumes itself,
and it consumes only repositories of the same product. A link holds the same fields a plan
repository's targets hold ([Several repositories](/docs/several-repositories#read-only-and-consumer-targets)).

The workspace's owners add, edit and remove links on the product home's **Repositories &
approvers** tab; every other member reads it. A repository is also linked on its own when a PRD of
the product touches it (below); the tab marks such a link as added by a PRD.
**Settings › Repositories** shows each repository's products as chips, each opening that product's
home.

To see the products of the repository you are in, type:

```bash terminal agent
omni product which
```

It prints one product per line, or `none`.

## A PRD's product

A PRD takes its product when it is born, from its repository:

| its repository is in… | the PRD's product |
|---|---|
| one product | that product |
| no product | none |
| several products | the one you pick, or none |

Only in the third case does `/omni:brainstorm` (or `/omni:mega-brainstorm`) ask one question:
*"Which product is this PRD for?"*, with the repository's products and **No product**. With one product or
none it asks nothing. The answer travels with the PRD's first push to the Omni page
(`omni dossier push <n> --product <name>`). An idea, a bug fix and a visual fix follow the same table,
without the question: a repository in several products gives them no product.

To read a PRD's product in the terminal, type:

```bash terminal agent
omni prd 600
```

with your PRD's number. Its last line is `product: <name>`, or `product: none`.

A PRD's product decides who approves it, and which claims and personas it is written for, even when
its repository is in two products. Giving a PRD a product links its repository to that product, and,
for a PRD across several repositories, every repository its plan names. Removing a repository from a
product never changes a PRD's product.

### Change it

The PRD's page on the Omni page shows a **Product** picker, the workspace's products and **No
product**, to every member, until the PRD is approved. Once an approval is in force, the picker is
locked and says `product is locked: PRD <n> is approved`, because that product's approvers decided.
An approval that is voided unlocks it.

## The product home

**Products**, first under **Work** in the sidebar, lists the workspace's products as cards: each with
its repositories (a repository another product links too is marked shared), its PRD count and how many
of its PRDs wait on your approval. Under the cards, the repositories in no product, each with **Add to
a product**, which opens a product's **Repositories & approvers** tab with that repository picked.

A card opens its product home, at `/app/products/<id>`. It shows only that product's items, in tabs:

| tab | what it shows |
|---|---|
| **Ledger** (it opens on it) | what waits on whom, in three lanes: *on you*, *on GitHub review*, *on the agent*; each PRD with its number or seal, ◆ or ◇, one state word and its pull requests; above them, how many are building, waiting on a person and drifted |
| **PRDs** | every PRD of the product, newest first, with where it was born and its state |
| **Ideas** | the product's ideas, each with its board, its lane and its `/omni:brainstorm` line |
| **Roadmap** | the product's roadmaps |
| **Bug fixes** | the product's bug fixes |
| **Visual fixes** | the product's visual fixes |
| **Questions** | every open outbox question of the product's PRDs, with its PRD, the repository it was raised in and who it is for. A [product PRD](#a-product-prd)'s question is answered right here; any other PRD's links to its PRD page's Outbox tab |
| **Repositories & approvers** | the product's repositories with their links' fields, which an owner edits, and **Add a repository**; under them the **Approvers** list |

A PRD waits *on you* when it waits for your approval or for your answer; one under review sits *on
GitHub review*, and one being built or ready to build *on the agent*.

The workspace's own lists stay as they are, each with a product filter: all, one product, or no
product. They are the PRDs, the roadmaps, the bug fixes and the visual fixes, and the concepts. Each
item shows its product id beside its number: `mobile-12` for a product PRD, `mobile-R3` for a
roadmap, `mobile-B74` for a bug fix. Each repository's ideas board stays as it was, and its filter
only the workspace's members see.

**Work › Questions** is the workspace's own list of questions, in two tabs. **Inbox** holds the
questions the ask mode put to you. **Outbox** holds the open outbox items of every PRD of the workspace, product PRDs and repository
PRDs alike, with their product and PRD id, the ones waiting on you first. A product PRD's question is
answered in place, as before. A repository PRD's question is answered on its PRD page's Outbox tab
(`/prd/<id>?tab=outbox`), which sends the answer to its feature pull request; its row links there and
shows `as of <time>`, the last time the server read it, which can lag up to 15 minutes behind an
answer typed on GitHub. A repository PRD's medium items are not listed.

## The rollout ladder

Each repository of a product climbs a **rollout ladder** of five steps, one at a time:

| step | what the repository has |
|---|---|
| 1 | approval on the Omni page |
| 2 | the gate, read from the Omni page |
| 3 | the outbox, its open questions answered on the page |
| 4 | phase 0 born on the server |
| 5 | roadmaps and bug records born on the server |

A repository at step 5 gets the new records: a roadmap is `<key>-R<n>` and a bug record is
`<key>-B<n>`, both in its product (see [Roadmaps](/docs/roadmaps#in-a-product-on-the-server) and the
bug records below). A repository below step 5 keeps working the way it always has, from git.

A record keeps the place it was born in for life. A roadmap or bug record born in git finishes in
git, and moving a repository back down the ladder changes only where its new records are born.

### Bug records

At step 5, a bug fix is a record on the product, `<key>-B<n>` (such as `mobile-B74`), with its own
counter apart from the PRDs'. Its **Fixes** rows, one per fix (its repository, its pull request,
what changes, its reproduction and its guard), are on its page, and `omni bug push --product mobile`
writes them. Each row's repository must be one of the product's; a row naming another is refused by
name, and nothing is written.

Every fix pull request's description carries the record: `Fixes mobile-B74 · <link>`, then the
reproduction and the guard, so `git log` and blame still lead to the why. The merge stamps each row
as its pull request merges, and the record **ships** on the last merge. A pull request closed without
merging leaves its row not merged and the record open. No record pull request is opened and no issue
is made, in a plan repository either.

### Knowledge packs

Imported knowledge is served as a **pack** from the product, not copied into a repository. On a merge
that touches a repository's knowledge folder or flow config, the Omni App takes a snapshot of those
files at that commit, and the newest snapshot is the pack. `omni kb pack get <repo>` writes it to
`.omni-loop/local/packs/` in your checkout, read-only and ignored by git, and prints the folder. When
the server cannot be reached, it prints the newest pack already fetched, with its commit and its age.
A pack older than the commit your product link was read at is refused, never used, and `/omni:do-work`
stops the slice with `pack stale: <sha> < read_at <sha>`. A workspace's token reads only its own
workspace's packs.

### The Repositories tab

A product's **Repositories & approvers** tab shows each repository's ladder step, and, under it, what
still lives in the repository's plan repository: a repository below step 5 (`vertuo-web · step 3`),
and any open roadmap or bug record that is still born in git (`roadmap 0412 · in git`). This is
information only. The plan repository is kept: the loop never archives it, and the tab has no archive
action. A plan repository keeps its roadmaps, bug records and imported knowledge copies working side
by side with the product way.

## A product PRD

## A product PRD

A feature that lands in several of a product's repositories can live on the product itself. Such a
**product PRD** (◆) has no home repository, no GitHub issue and no folder in any repository. Its id
is the product's key and a counter, such as `mobile-12`. Its spec, plan, before/after page and voice
are versions on its page on the Omni page. The questions its agents raise are kept there too.

Its code still lands on GitHub: one feature pull request per repository, each saying
`Part of mobile-12`. There is **no plan repository, no phase-0 pull request and no plan pull
request**. You approve it once, on its page, and you answer its questions once, on the product's
**Questions** tab.

A PRD in a plan repository works as before ([Several repositories](/docs/several-repositories)). A
product PRD is the other way to build across repositories.

### Before you start

- **The product has a key.** One short lowercase word, such as `mobile` or `field-app`, that starts
  every one of its PRD ids. An owner of the workspace sets it once, and nobody changes it after. The
  Omni page has no field for it yet: an owner sets it through the database's `product_set_key`.
- **You run from a repository of the product** that has the loop installed, a plan repository or
  not, signed in to the Omni page (`omni signin`).
- **Every repository it lands in has phase 0 on the server.** A repository still on phase-0 pull
  requests cannot take a product PRD. To check, type:

```bash terminal agent
omni product phase0 vertuoza/vertuo-mobile vertuoza/vertuo-api
```

It prints one line per repository: `is phase0: server`, or
`is phase0: pr · switch it to server on its Omni page, or leave it out`.

### Brainstorm it

In a checkout of one of the product's repositories, type (in your agent's form:
[Any coding agent](/docs/any-agent#set-up-your-agent)):

```text agent
/omni:mega-brainstorm --product mobile
```

with your product's key. The checkout remembers the product from then on (`omni product use mobile`
does the same alone, and `omni product which` names it first). The brainstorm talks the idea
through with you and asks which repository does what: it never assumes it. It refuses a repository
whose phase 0 is not on the server, by name, and you leave it out or switch it.

It then creates the PRD on the Omni page and prints its id and its page. Nothing is written in any
repository: no issue, no branch, no commit, no pull request. `omni plan check` does not grade a
product PRD's plan yet: the hand-off says so. Its last lines are what to do next: approve the PRD on
its page, then run `/omni:ultra-yolo mobile-12`.

To read a product PRD in the terminal, type:

```bash terminal agent
omni prd mobile-12
```

It prints its state, `birthplace: server`, its approval, its page and its product. With
`--show spec` (or `plan`, `before-after`, `voice`) it prints that file, read-only, under a line
saying its version and when it was read. The last copy read answers while the Omni page is down,
marked `as of` that time; no gate ever trusts it.

### Approve it

An approver of the product approves it on its page, as for any PRD born on the server
([The approval handshake](/docs/loop#the-approval-handshake)). The approval pins every file by its
hash. A later change to a pinned file voids it, and the PRD must be approved again.

### Build it

Once it is approved, from the same checkout, type:

```text agent
/omni:ultra-yolo mobile-12
```

It waits for the approval when there is none yet, asking again every minute, for up to an hour. It
refuses to build a PRD whose approval was voided, and it parks, without failing, while the Omni page
does not answer. It reads the plan from the PRD's page, clones each repository, and opens one draft
feature pull request in each. Each one's description starts with `Part of mobile-12` and the
PRD's page. It builds the slices wave by wave, as for any PRD across repositories, and sends every
decision an agent took alone to the PRD's questions on the Omni page.

### The two checks

The Omni Loop GitHub App posts two checks on each of those feature pull requests:

| check | what it says |
|---|---|
| **`omni/approved`** | `building · 4 of 4 pinned` when every pinned file is the one approved; `drifted · ≠ plan.md in <commit> · content` (or `· whitespace only`) when one changed; `held · server unreachable since <time> · held, not failed` when the Omni page cannot be read. It fails while nobody approved the PRD (`pending`), or when the approver left the workspace |
| **the outbox check** | `0 open · one gate on Mobile` once no question is open; `3 open · answer on Mobile › Questions` while three wait on a person |

**Details** on `omni/approved` opens the PRD page's attestation: who approved it and when, whether
they are still a member and an approver of the product, and each pinned file's hash beside today's.
A drifted file offers **Restore** (its approved version) and the card **Ask again** (the approve
screen).

The App posts both checks when a pull request opens or moves, and again when the Omni page says the
PRD was approved, its approval voided, or a question raised or answered. It never polls.

### Answer its questions

The product home's **Questions** tab lists every open question of the product's PRDs, the most
pressing first within each PRD, each with its PRD, its repository and who it is for. A product
PRD's question shows its options as buttons, **A** being what the agent built, and **other…** for
an answer of your own. An answer that does not say whether it keeps what was built is refused, never guessed.
An answer is saved at once, and the outbox check follows. Nothing is posted on GitHub.

You can also answer in the terminal, at the end of a red `/omni:ultra-yolo`: it offers to take the
answers there.

### Ready

The one gate is read from the Omni page:

```bash terminal agent
omni status mobile-12
```

Once it is green and every repository's CI is green, `/omni:ultra-yolo` marks each feature pull
request ready, in the order to merge them. Merging them is yours. To keep them green and their
review comments handled, run `/omni:mega-pr-care mobile-12`. To drive several, run
`/loop /omni:mega-drive mobile-12`: a product PRD is driven only when you name it.

### What does not work yet

- **The PRDs list and a PRD's page** still expect every PRD to have a home repository. Until they
  learn otherwise, a product PRD may not show in the list, or may break it. Read it with
  `omni prd mobile-12`.
- **A changed answer given on the Questions tab** is not reworked by `/omni:ultra-yolo-fix`, which
  reworks only the answers given in the terminal in the same run. It reports the others as held.
- **The gate counts open questions only.** A question answered with a change does not hold it until
  the change is made. The Omni page keeps no record yet of the risky changes an agent accounts for:
  the run names them in its report.
- **`omni board`, `omni next`, `omni care` and `omni loop`** read a repository's PRD numbers only.
  The skills read the plan and the pull requests themselves, and each says in its report which
  command did not run.
- **One feature pull request per repository.** A product PRD's plan cannot be split into landings.

## A plan repository reads its targets from a product

A plan repository lists its targets in its config (`plan.targets`), a copy of what a product already
knows. It can name the product instead (`plan.product`), and `omni targets` then reads the product's
links from the Omni page. [Several repositories](/docs/several-repositories#name-a-product-instead) shows how.

[Next → Several repositories](/docs/several-repositories)
