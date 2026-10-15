---
id: s6-02-law-proof-files-gain-sync-tests
prd: 1990
slice: s6
rank: high
bears-on: N-PRODUCT-12, BR-PRODUCT-91, BR-PRODUCT-104
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Three test files that prove rules of the product gained tests for the new sync badge: can a person confirm the rules they prove still hold as they did?

## The decision, in plain words

The rules' own checks are unchanged: each file gains the badge's tests beside them, and one test helper that records the processes the status line starts was rewritten to also record the background refresh.

## The intro, for fun

Three more guards of the product's rules got a visitor.

## The punchline, for fun

The visitor brought a badge, not a key.

## The options, in plain words

A. Keep the added tests where they are: the laws' checks are untouched, and the files gain checks of the new badge.
B. Move the badge's tests to files of their own, leaving the law-proof files as they were.

## What I had to decide

kit/bin/now.test.ts (+39 lines), kit/bin/statusline.test.ts (+90, -6) and kit/plugin-hud/tests/hud.test.tsx (+36) prove laws of the product. s6 added tests for the sync field of omni now, the status line's badge and its background refresh, and the HUD band's first row (spec Solution › 8). The six removed lines in statusline.test.ts are the old spawn-recording helper, rewritten; no assertion of a law was removed or changed. The slice raised no item for these files when it built them; the finish found them unaccounted and raised this one.

## What I did meanwhile

All three files keep every assertion they had. now.test.ts and statusline.test.ts pass in the full test run; the HUD tests run only under `claude plugin test`, which was not available, so they were written but not run.

## What it costs to change later

Moving the tests to files of their own is a move of three blocks, undone by a revert.

## What I could not know

(author) Whether badge tests belong beside the law proofs or in files of their own was not asked (author).
