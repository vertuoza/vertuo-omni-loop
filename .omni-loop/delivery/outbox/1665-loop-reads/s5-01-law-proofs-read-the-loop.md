---
id: s5-01-law-proofs-read-the-loop
prd: 1665
slice: s5
rank: high
bears-on: BR-PRODUCT-86
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Three rules about roadmaps and the status line were proven by tests that pretended to be GitHub, and those tests now pretend to be the Omni page instead, while one rule still names GitHub in its words: is that change to the proofs fine, and should the rule's words follow?

## The decision, in plain words

I moved the tests onto the same pretend Omni page the other commands use, kept every outcome they check, and left the rule's words as they are for its owner to reword.

## The intro, for fun

The rule still names the old messenger, though the letters now come by a new road.

## The punchline, for fun

Same letters, same answers; only the stamp on the envelope changed.

## The options, in plain words

A. A. Keep the proofs on the shared pretend Omni page, and leave the rule's words as they are.
B. B. Keep the proofs on the shared pretend Omni page, and reword the rule to say the loop, not GitHub.
C. C. Keep a copy of the old GitHub-shaped tests beside the new ones.

## What I had to decide

Whether the proofs of BR-PRODUCT-86 (kit/lib/roadmap/push.test.ts, kit/bin/roadmap.test.ts), BR-PRODUCT-81 (kit/lib/roadmap/push.test.ts) and BR-PRODUCT-91 (kit/bin/statusline.test.ts) may move from gh stubs to the shared fake LoopReads, and whether BR-PRODUCT-86's 'If GitHub is unreadable, nothing is pushed' should now read 'If the loop cannot be read'.

## What I did meanwhile

Every case those tests checked still runs on the same data through fakeLoopReads; the push still sends nothing when a read fails, now printing the read's own line ('no sign-in (omni signin)', 'unreachable', 'refused (403): …') where it printed 'github unreachable'. The rule's text in .omni-loop/knowledge/product/rules.md is untouched.

## What it costs to change later

A sentence in the rule's text, or reverting the test files with the kit's landing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the knowledge register wants the rule reworded in this PRD or left for a later knowledge pass.
