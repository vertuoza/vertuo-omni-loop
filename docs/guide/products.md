---
title: Products
description: Products are optional — a repository in no product, one or several, a PRD's own product, the product home on the Omni page, and a plan repository reading its targets from a product.
---

A **product** is what your company sells or runs, such as *Mobile* or *Estimates*, kept on the Omni
page. It gathers the repositories it is built from and the PRDs, ideas and fixes made for it, and it
decides who approves its PRDs. This page shows how products and repositories link, how a PRD gets
its product, and the product's own page, its **product home**.

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
| **Questions** | the outbox questions of the product's PRDs that wait on a person, each linking to where you answer it today, the PRD page's Outbox tab |
| **Repositories & approvers** | the product's repositories with their links' fields, which an owner edits, and **Add a repository**; under them the **Approvers** list |

A PRD waits *on you* when it waits for your approval or for your answer; one under review sits *on
GitHub review*, and one being built or ready to build *on the agent*.

The workspace's own lists stay as they are, each with a product filter: all, one product, or no
product. They are the PRDs, the bug fixes and the visual fixes, and each repository's ideas board,
whose filter only the workspace's members see.

## A plan repository reads its targets from a product

A plan repository lists its targets in its config (`plan.targets`), a copy of what a product already
knows. It can name the product instead (`plan.product`), and `omni targets` then reads the product's
links from the Omni page. [Several repositories](/docs/several-repositories#name-a-product-instead) shows how.

[Next → Several repositories](/docs/several-repositories)
