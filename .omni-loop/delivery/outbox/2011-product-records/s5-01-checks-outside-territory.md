---
id: s5-01-checks-outside-territory
prd: 2011
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The new database check for bug records only protects us if the automatic checks run it, and one older check said a product could never have a bug of its own. Who changes those two files, which sit outside this slice's ground?

## The decision, in plain words

This slice made both small changes itself: the automatic checks now run the new bug-records check, and the older check now proves a product still cannot hold a visual fix, instead of a bug, since product bugs are now allowed.

## The intro, for fun

A brand new safety check is useless if nobody ever runs it.

## The punchline, for fun

So it joined the line-up, and an old check stopped arguing with it.

## The options, in plain words

A. Keep both changes as made: the new check runs on every pull request, and the old refusal tries a visual fix (as built)
B. Keep the old check's change but drop the workflow step, so the new check runs only when someone runs it by hand
C. Undo both and let a person add them on the feature branch before it is marked ready

## What I had to decide

Whether s5 may add a step to the supabase workflow and adjust one refusal in product_prd_ids.sql, both outside its territory, or leave them to a person or another slice.

## What I did meanwhile

Added one step to .github/workflows/supabase.yml that runs supabase/checks/fix_rows.sql, as every other check is run. In supabase/checks/product_prd_ids.sql, the refusal 'a product dossier of another kind was written' tried a `bug` dossier on a product, which this migration now allows on purpose; it now tries a `visual` one, which is still refused. Nothing else in either file changed.

## What it costs to change later

A constant: removing the workflow step, or putting the old example back, is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists supabase/checks/fix_rows.sql in s5's territory but not the workflow that runs it, and no slice of landing 2 owns .github/ (author)
- No slice owns supabase/checks/product_prd_ids.sql in this PRD; leaving it unchanged would leave the supabase check red (author)
