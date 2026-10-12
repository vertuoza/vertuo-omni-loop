---
id: s4-04-replies-without-standing
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

To tell whether the open questions were answered, the next-step command counted only replies from people allowed to change the repository, but the Omni page does not say who is allowed. Whose replies should count?

## The decision, in plain words

Every person's reply counts for this hint. It only decides that answers may be waiting; the step it then launches reads the replies again and keeps only those of people allowed to change the repository.

## The intro, for fun

The guest list went missing, so the doorman lets everyone into the lobby.

## The punchline, for fun

The real check still happens at the ballroom door.

## The options, in plain words

A. A. Count every person's reply for this hint (built).
B. B. Add the author's standing to the page's answer for comments, and keep counting writers only.
C. C. Count no reply here, and let the outbox gate alone say answers are waiting.

## What I had to decide

outboxFacts in next.ts fed planReplies GitHub's comments with author_association, and isCountedReply keeps OWNER, MEMBER and COLLABORATOR only. LoopComment is {id, author, body, createdAt, updatedAt}, with no association. Built: each LoopComment is handed to planReplies as a COLLABORATOR's (replyCommentOf), so any person's numbered reply makes `answered` true and the verdict `act yolo-fix`. kit/lib/outbox/replies.ts is unchanged. The other comment reads (the status comment's updatedAt for a running step, the roadmap issue's answers and ticks) never used the association.

## What I did meanwhile

Built and tested: a numbered reply on the feature PR gives act yolo-fix, as before.

## What it costs to change later

A field in the contract (the author's standing) and one line in next.ts to pass it on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A reply from someone outside the repository's writers now launches a yolo-fix run that will find nothing to settle; whether that run stops cleanly was not checked.
