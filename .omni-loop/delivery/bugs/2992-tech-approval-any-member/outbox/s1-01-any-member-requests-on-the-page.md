---
id: s1-01-any-member-requests-on-the-page
prd: 2992
slice: s1
rank: high
bears-on: BR-PRODUCT-108
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The page used to offer "Request a Tech Approval" only to the person who wrote the PRD. Should any member of the workspace see it, as long as the PRD is not approved and nobody has asked yet?

## The decision, in plain words

Any member sees it now. The test that checks who sees the approval area had a line saying another member does not, and that line now says they do.

## The intro, for fun

Who gets to knock on the engineer's door?

## The punchline, for fun

Anyone with a key to the building, as long as the door is still open.

## The options, in plain words

A. Any member of the workspace can ask for a Tech Approval on a PRD that is not approved (built).
B. Keep it for the author only, and other members ask the author to request one.

## What I had to decide

BR-PRODUCT-108 is proven by `apps/galaxy/src/dossier/page/approval.test.ts`. One assertion in the Tech Approval test there said a member who is not the author gets no request button. It now says they do (`canRequestTech` true for Bob). BR-PRODUCT-108's own assertions are unchanged.

## What I did meanwhile

The branch offers the button to any member, and the new tests in `tech-request-any-member.test.ts` pin it.

## What it costs to change later

Revert one line in `approval.ts` and one assertion in the test.

## What I could not know

- Whether a member who is not the author should also be kept from naming themselves: the branch lets them, and only refuses naming the author (author).
