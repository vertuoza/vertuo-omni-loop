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

The rename touches the names of about five hundred files. Should the written records that name them (past plans, decisions, the team's playbook) be rewritten to the new names too?

## The decision, in plain words

The guides, the readme files and the code-quality settings now use the new names. The past plans, the decisions, the playbook and the recorded test data keep the old names, as they were written.

## The intro, for fun

Five hundred files changed their surname overnight, and the family album still has the old one.

## The punchline, for fun

The album stays as it was; only the address book got updated.

## The options, in plain words

A. A: rewrite guides, readme files and the code-quality settings; leave past records, knowledge and recorded test data as written
B. B: rewrite everything, the past records and the knowledge included
C. C: rewrite only the slice's own folders, and leave guides and code-quality settings to a later change

## What I had to decide

Which files outside the slice's folders the rename may rewrite: the root and app readme files, the user guide, the code-quality tool's settings and saved findings were rewritten; the delivery records, the knowledge folder (playbook and decision records included), the kit's porting notes, the design specs and plans, the migrations and the recorded test fixtures were left as written.

## What I did meanwhile

scripts/ts-rename.mjs rewrites every text file except those under .omni-loop/delivery/, .omni-loop/knowledge/, kit/porting/, docs/superpowers/, supabase/migrations/ and any fixtures/ folder. Outside the territory it changed README files, docs/guide, .fallowrc.jsonc and the three fallow/*.json baselines (file names only). The playbook forms testing.md and verification.md still name kit/lib/config.test.mjs, vitest.config.mjs and kit/test/dist.test.mjs.

## What it costs to change later

Running the script with a shorter frozen list rewrites the records in one commit; the playbook's three stale file names are a two-line edit by whoever owns the playbook.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s2 does not name README files, docs/, .fallowrc.jsonc or fallow/, yet the spec asks the rename to rewrite every path that names a renamed file
- (author) Whether the playbook forms under .omni-loop/knowledge/playbook/ are records or living instructions is not written down
