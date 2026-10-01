---
id: s2-01-rename-leaves-records-as-written
prd: 725
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

The rename changes the names of about five hundred files. Should the written records that name them, such as past plans and decisions, be rewritten to the new names too?

## The decision, in plain words

Everything that says how things are today now uses the new names: the readme files, the team's playbook and the code-quality settings. Past plans, past decisions and recorded test data keep the old names, as they were written.

## The intro, for fun

Five hundred files changed their surname overnight, and the family album still has the old one.

## The punchline, for fun

The album stays as it was; only the address book got updated.

## The options, in plain words

A. A: rewrite readme files, the playbook and the code-quality settings; leave past plans, past decisions and recorded test data as written
B. B: rewrite everything, the past plans and decisions included
C. C: rewrite only the slice's own folders and the playbook, and leave the code-quality settings to a later change

## What I had to decide

Which files outside the slice's folders the rename may rewrite: the readme files, the playbook forms and the product registers, the code-quality tool's settings and saved findings were rewritten; the delivery records, the decision records, the kit's porting notes, the design specs and plans, the migrations and the recorded test fixtures were left as written.

## What I did meanwhile

scripts/ts-rename.mjs rewrites every text file except those under .omni-loop/delivery/, .omni-loop/knowledge/adr/, kit/porting/, docs/superpowers/, supabase/migrations/ and any fixtures/ folder. Inside the territory it changed the README files of game/, apps/ and packages/; outside it, .omni-loop/knowledge/playbook/ (four forms), .omni-loop/knowledge/product/invariants.md (one line), .fallowrc.jsonc and the three fallow/*.json baselines (file names only). The playbook had to follow: `omni check kb` fails when a form's evidence names a file that no longer exists.

## What it costs to change later

Running the script with a shorter frozen list rewrites the past records in one commit; putting a readme or the playbook back is a revert of its few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s2 does not name .omni-loop/knowledge/, .fallowrc.jsonc or fallow/, yet the spec asks the rename to rewrite every path that names a renamed file
- (author) Whether a decision record that names a file should follow a rename is not written down
