---
id: s17-02-archive-owner-only-no-plan-setter
prd: 2011
slice: s17
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

Who may press Archive, and where does a product's plan repository get named in the first place?

## The decision, in plain words

Only a workspace owner sees the Archive button and the database refuses anyone else; every other member reads the same holds as text. A product with no plan repository named shows no archive section at all, because this slice adds no screen to name one.

## The intro, for fun

The big red button has one keyholder, and the lock has no key yet.

## The punchline, for fun

First someone must say which repository is the plan.

## The options, in plain words

A. A. Workspace owners only, and no screen yet to name the plan repository (as built)
B. B. Every approver of the product may archive, which needs a change to the database function
C. C. Add a control to name the plan repository in this tab now, in a follow-up slice

## What I had to decide

Whether Archive stays with workspace owners (as the database already enforces) or opens to every approver of the product, and whether a later slice should add the control that names the plan repository.

## What I did meanwhile

The Repositories tab shows the ladder for every product, and the plan-repository section (holds, Archive, Undo) only when products.plan_repository is set. Setting it still goes through product_plan_repository_set() with no screen in this slice.

## What it costs to change later

A constant for who may press: the owner check in the service and the database function product_repository_owned(), so widening it to approvers is a migration plus one line. A control to name the plan repository is one small form in the same tab.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The draft screen leaves open who may archive, and the spec says only that a person presses the button
- (author) No slice of the plan builds the control that sets the plan repository, so until one does an owner sets it through the database function
