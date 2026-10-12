---
id: s3-01-unhanded-token-left-unusable
prd: 1660
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

When a terminal token is made from the code check page but the terminal's request stopped waiting in the meantime, what happens to that token nobody will receive?

## The decision, in plain words

Its sign-in is ended at once, so the token can never be used, but it stays listed on the person's profile until it expires or they revoke it.

## The intro, for fun

A token was made, and its terminal had already left the room.

## The punchline, for fun

It keeps its name tag, but no door opens for it.

## The options, in plain words

A. A. Keep it listed but unusable: its sign-in ended, it expires on its own
B. B. Delete it at once through a new server-only database function

## What I had to decide

Keep the unhanded token listed but unusable (A), or remove it at once (B).

## What I did meanwhile

Built as A: when attaching the token to the request fails or finds it no longer waiting, the fresh sign-in sealed in the token's row is ended, so any exchange of that token answers revoked.

## What it costs to change later

B is one new database function that deletes a kit token by its hash for the service role, and one call in the callback: no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a request no longer pending attaches nothing, but not what becomes of a token made just before that was found; the kit tokens have no revoke function the server can call today.
- (author) It only happens when the request expires, is refused or is approved elsewhere during the few seconds of the sign-in, or when the database fails then.
