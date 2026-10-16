---
id: s3-01-mcp-server-test-proves-br-product-66
prd: 1795
slice: s3
rank: high
bears-on: BR-PRODUCT-66
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The agent link's tests now also check the legal entries and the glossary, in the same file that proves the rule "Jev judges an agent's question only on the report that first stores it". Is that all right?

## The decision, in plain words

The new tests sit beside that rule's own tests, and none of the rule's tests or the code it governs changed.

## The intro, for fun

A new shelf went up in the room where the rule's proof lives.

## The punchline, for fun

Nobody moved the rule's own furniture.

## The options, in plain words

A. Keep the new tests in the same file as that rule's proof (what was built)
B. Move the new tests to a file of their own, so the rule's proof is left alone

## What I had to decide

Whether tests of the agent link's two new fields may live in the test file that also proves BR-PRODUCT-66.

## What I did meanwhile

Kept them in `apps/galaxy/src/agent-connect/mcp/server.test.ts`, next to the `get_business` tests already there. Every test of BR-PRODUCT-66 still passes unchanged.

## What it costs to change later

Moving the new tests to another file is a small follow-up change; nothing stored changes.

## What I could not know

(author) Whether the owner of BR-PRODUCT-66 wants its proof file to hold only that law's tests.
