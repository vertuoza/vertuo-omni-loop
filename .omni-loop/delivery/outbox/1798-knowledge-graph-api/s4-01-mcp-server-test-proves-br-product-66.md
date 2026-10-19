---
id: s4-01-mcp-server-test-proves-br-product-66
prd: 1798
slice: s4
rank: high
bears-on: BR-PRODUCT-66
raised: 2026-10-19
wave: 3
---

## The question, in plain words

The agent link's new knowledge graph tool is tested in the same file that proves the rule on how Jev judges an agent's first question, and the check there that counts the link's tools now counts four. Is that all right?

## The decision, in plain words

The new tool's tests sit beside that rule's own tests, as the plan asked, and the tool count went from three to four. None of the rule's own tests, nor the code it governs, changed.

## The intro, for fun

A fourth tool joined the toolbox, and the toolbox lives in the rule's room.

## The punchline, for fun

The rule's own shelf was not touched; only the head count on the door changed.

## The options, in plain words

A. Keep the new tool's tests in the same file as that rule's proof (what was built)
B. Move the new tool's tests to a file of their own, leaving only the tool count change in the rule's proof file

## What I had to decide

Whether the tests of get_knowledge_graph may live in apps/galaxy/src/agent-connect/mcp/server.test.ts, the file that also proves BR-PRODUCT-66, and whether its tool-listing test may count four tools. Decided by: Jev (hardToRevert 0.74) · agent said false

## What I did meanwhile

Kept them in `apps/galaxy/src/agent-connect/mcp/server.test.ts`, beside the get_business tests, as the plan's done-when for s4 names it (PRD 1795 s3-01 settled the same for that file). The listing test now expects four tools and checks get_knowledge_graph's description and inputs; the `law BR-PRODUCT-66` test and the code it reads are unchanged, and every one of its tests still passes.

## What it costs to change later

Small: moving the new tests to a file of their own is a follow-up change of tests only; the tool count line stays, since a fourth tool is listed whatever file tests it. Nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the owner of BR-PRODUCT-66 wants its proof file to hold only that rule's tests, now that the link has a fourth tool.
