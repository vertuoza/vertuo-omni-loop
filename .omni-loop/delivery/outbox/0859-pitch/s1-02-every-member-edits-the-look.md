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
