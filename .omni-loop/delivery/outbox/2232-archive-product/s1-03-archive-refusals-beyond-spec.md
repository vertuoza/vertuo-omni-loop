---
id: s1-03-archive-refusals-beyond-spec
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Besides the changes the spec names, should every other change to an archived product be refused too?

## The decision, in plain words

Yes: nothing about an archived product can change until it is restored. Its personas, Never lines, claims, pitch, name, approvers, Legal and glossary edits and proposals are refused, a PRD cannot be moved onto it, a roadmap push naming it is refused, and a PRD push never links repositories to it.

## The intro, for fun

The spec locked the front door and two windows.

## The punchline, for fun

We checked the back door and the cat flap too.

## The options, in plain words

A. A. Refuse every change to an archived product, the spec's named functions and the others (built).
B. B. Refuse only what the spec names, and let personas, Never lines, pitch, name, approvers and roadmap pushes still change it.

## What I had to decide

The spec names product_repository_owned(), product_knowledge_product() and product_of_key(); the slice's title says its content can no longer change. Other database functions change a product named by id, through business_product(), the approvers' and proposals' own lookups, dossier_set_product(), roadmap_push() by name and dossier_link_repositories().

## What I did meanwhile

Built A: business_product(), product_knowledge_entry_product(), product_knowledge_open(), product_approver_set() and product_approver_remove(), dossier_set_product() and roadmap_push() refuse an archived product with the archived message; dossier_link_repositories() and dossier_push()'s name pick skip it. supabase/checks/product_archive.sql proves the cases the spec names.

## What it costs to change later

A follow-up migration restoring any of these functions as they were; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Only the functions the spec names are proven by the check; the others share the same one-line guard.
