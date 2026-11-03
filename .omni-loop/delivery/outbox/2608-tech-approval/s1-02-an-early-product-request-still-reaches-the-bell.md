---
id: s1-02-an-early-product-request-still-reaches-the-bell
prd: 2608
slice: s1
rank: medium
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

If someone asks the product's approvers before the Tech Approval is given, should the database refuse that request, or record it and let the approvers' bell show it while their approval stays refused?

## The decision, in plain words

The database records it: the product's approvers see the request in their bell, but their approval is refused, naming who it waits on, until the Tech Approval is given. Keeping the terminal and the page from asking early is left to the slices that build them.

## The intro, for fun

Knocking on the second door before the first one opens is allowed; walking through is not.

## The punchline, for fun

The doorbell rings, the lock holds, and the sign says who has the key.

## The options, in plain words

A. A. Record an early request; only the product approval waits (what was built).
B. B. Refuse a product request while a requested Tech Approval is not given.

## What I had to decide

Keep asking open: only the approval itself waits. A later slice may refuse an early request with one more check in the same function.

## What I did meanwhile

A product approver asked early sees the request, presses approve, and reads that the PRD waits for the named person's Tech Approval.

## What it costs to change later

One check to add in the request function if early requests should be refused; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the product's approvers are asked once the Tech Approval is given, but does not say what an earlier request does (author).
