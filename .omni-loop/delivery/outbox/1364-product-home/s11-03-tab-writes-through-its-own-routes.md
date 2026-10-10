---
id: s11-03-tab-writes-through-its-own-routes
prd: 1364
slice: s11
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

How should the new tab save what an owner changes: repositories added, edited or removed, and approvers set?

## The decision, in plain words

Every change goes through the app's server, under the tab's own address, which checks the sign-in first and lets the database decide who may; the browser no longer writes to the database itself, and a new repository is added with no role yet, to be filled in on its row.

## The intro, for fun

The front desk used to hand out keys to the storeroom.

## The punchline, for fun

Now it fetches what you need and checks your badge on the way.

## The options, in plain words

A. A. Routes under the tab's own address, a new repository added with no role, the option built.
B. B. Routes beside the other product calls the command line makes.
C. C. Ask for the role before adding a repository, in the Add form.

## What I had to decide

Where the tab's writes go (ADR-0095's client, controller, service, repository, inside the slice's territory), and what a freshly added repository's link holds.

## What I did meanwhile

Four routes under apps/galaxy/app/app/products/[id]/repositories/: POST and DELETE links, POST and DELETE approvers (src/product-repositories/repositories-tab.controller.ts), rather than under app/api/products/, which is s4's and s5's ground. The Approvers list's writes moved there too, so src/products/approvers.ts and approvers-load.ts leave the layering baseline. Add a repository writes the link with no role, its own knowledge base, not read only and consuming nothing; the owner then sets its fields and saves the row whole.

## What it costs to change later

Moving the routes under /api is a rename of two folders and of two paths in the contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and ADR-0095 do not say where a page's own write routes live when the plan gives /api/products to other slices.
