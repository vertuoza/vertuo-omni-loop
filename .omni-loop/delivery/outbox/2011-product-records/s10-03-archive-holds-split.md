---
id: s10-03-archive-holds-split
prd: 2011
slice: s10
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Archiving a product's plan repository must be refused while anything still holds it. Which of those holds does the database itself refuse, and which are left to the page that offers the button?

## The decision, in plain words

The database refuses the archive while any repository of the product is below the last step of the rollout ladder, naming each, and lets only an owner archive or undo; the open roadmaps, bug records and PRDs still born in the plan repository are left for the page's server code to check, since only it can see their state.

## The intro, for fun

Locking the old filing cabinet is easy; knowing nobody still keeps papers in it is the hard part.

## The punchline, for fun

The database checks the ladder, and the page checks the drawers.

## The options, in plain words

A. A. The database checks the ladder and the owner; s17's server code checks the open records and that a person pressed it (as built)
B. B. The database checks every hold, after a migration that stores each record's open state
C. C. The database checks nothing but the owner, and s17 checks every hold

## What I had to decide

Whether product_plan_archive() checks every hold the spec names, or only the ones the database can see (the ladder steps), leaving the open records born in the plan repository, and the rule that a person and not an agent presses the button, to s17's server code.

## What I did meanwhile

product_plan_archive() is owner-only, refuses with no plan repository, refuses naming each repository below step 5 (plan-web at step 3, joined by a middle dot), keeps the first stamp when archived twice, and clears it on undo; product_plan_repository_set() is owner-only, takes a repository the workspace lists, and refuses a change while archived. Neither checks open roadmaps, bug records or PRDs, whose open state lives on GitHub, and neither can tell a person's browser session from a kit token acting as that person.

## What it costs to change later

A follow-up migration if the database should check more holds; s17 can add its checks in its own server code at no database cost.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Dossiers and roadmaps carry no open or shipped state in the database, so which records are open in the plan repository is not readable there
- (author) A kit token signs in as its maker, so the database alone cannot refuse an agent pressing the archive
