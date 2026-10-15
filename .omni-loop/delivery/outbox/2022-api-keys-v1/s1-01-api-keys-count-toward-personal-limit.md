---
id: s1-01-api-keys-count-toward-personal-limit
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

An owner may hold at most 20 personal links and terminal tokens, and the API keys they make are counted in the same 20. Should API keys count only against the workspace's own limit of 20 keys instead?

## The decision, in plain words

We left the personal limit as it is, so the keys an owner makes still count toward their own 20 links and tokens, because changing that limit was outside this feature.

## The intro, for fun

Twenty is a lot of keys for one keyring.

## The punchline, for fun

Until the keyring is shared with the whole office.

## The options, in plain words

A. Leave the personal limit counting API keys, as built.
B. Leave API keys out of the personal limit in a follow-up migration, so only the workspace's 20 keys bound them.

## What I had to decide

Whether agent_tokens_live(), which counts a person's live tokens for the 20-per-person limit of agent links and kit tokens, should leave out the api scope.

## What I did meanwhile

Unchanged: an owner who made many API keys may hit the personal limit sooner. The spec puts any change to the agent link or kit tokens beyond the shared scope check out of scope.

## What it costs to change later

A one-line change to agent_tokens_live() in a follow-up migration, and its check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether any owner will make enough keys to meet the personal limit (author)
