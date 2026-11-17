---
id: s5-01-rule-on-sending-failed-prds-again-changes
prd: 2980
slice: s5
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-17
wave: 3
excuses: [apps/omni-app/src/missions/supervisor.test.ts, apps/omni-app/src/missions/mission.e2e.test.ts]
---

## The question, in plain words

The rule on when a mission sends a failed PRD again said never, and now a mission repairs it first: may the rule's words and the two tests that prove it change to say so?

## The decision, in plain words

The rule now says a failed PRD is sent again only when a repair allows it, and stops for good once its cause's three or the mission's nine repairs are spent, on a cancel, or when its repair needs a person or met an Omni Loop bug. Its two proof files keep every earlier case and add the new ones.

## The intro, for fun

The rule used to read never, and someone just wrote unless underneath it.

## The punchline, for fun

The tests signed the change too, but they want a person to countersign.

## The options, in plain words

A. The rule and its two proof files change together, to the repairs built here.
B. The rule and its proof files stay as they were, and a failed PRD keeps stopping at once.

## What I had to decide

Whether BR-PRODUCT-139's text in the product rules, and its two proof files (apps/omni-app/src/missions/supervisor.test.ts and apps/omni-app/src/missions/mission.e2e.test.ts), change with PRD 2980. The spec's Decisions name this change. supervisor.test.ts gains one describe, BR-PRODUCT-139 under PRD 2980: a failed, twice-held or twice-stopped PRD is repaired, a cancel never sends it again, the mission's 9 spent stops it, and repairs off stops it as before; its earlier tests are untouched and still pass, since the pure supervisor stops as before when no repairs are given. mission.e2e.test.ts gains one scenario: a step broken at 02:00 is repaired, its fix lands on the mission branch, the step runs again and the PRD reaches ready; its earlier scenarios are untouched.

## What I did meanwhile

Built as the spec asks: the rule's new text is in the product rules, the two proof files prove it, and the detailed repair tests live in files of their own (supervisor.repair.test.ts, repair.test.ts), so the law's files carry only its proof.

## What it costs to change later

Reverting is the rule's old sentence and the two added test blocks, together with setting the mission's repair budget to 0: a failure then stops its PRD as before.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rule is a proposed entry with no locked owner, so the person who answers this item is the one who confirms the new wording.
