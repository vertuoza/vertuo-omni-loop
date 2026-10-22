---
id: s7-01-token-covers-the-jobs-own-repository-only
prd: 2433
slice: s7
rank: high
bears-on: BR-PRODUCT-63
raised: 2026-10-22
wave: 3
---

## The question, in plain words

A bug fix that spans several repositories should get a GitHub token for its plan repository and every repository of its product that the API key may reach. The server cannot see which repositories a key may reach, so should the wider token wait until it can?

## The decision, in plain words

For now the token covers only the repository the job runs on, never more than the API key allows. A bug fix that needs to push to another repository of its product cannot do it with this token until the wider token is built.

## The intro, for fun

A bug fix asked the key which repositories it may touch, and the server could not read the answer.

## The punchline, for fun

So the token stays home until someone hands the server the guest list.

## The options, in plain words

A. Give the token only the repository the job runs on, and widen it later once the server can read which repositories each API key may reach.
B. Add a follow-up change that lets the server read each key's allowed repositories now, then widen the token to the plan repository and the product's other repositories within that list.
C. Widen the token now to every product repository the GitHub App holds, without checking the key's allowed list, accepting that it can reach repositories the key's owner never allowed.

## What I had to decide

The slice asks for a token that, for a mega-bug-fix job, also covers the plan repository and every repository its product names that the installation holds, each within the key's allowed repositories. The list of repositories a key may reach is stored in agent_tokens, which the service role cannot read, and the migration that would open it is outside this slice's territory (supabase/ is slice s1's). Widening the token without that list would reach repositories the key's owner never allowed, which BR-PRODUCT-63 forbids.

## What I did meanwhile

The claim and the refresh route mint a token for the job's own repository only, whatever the job's line says. The plan repository and the product's other repositories are not added. The list handed to the mint is one argument in mintFor, in apps/galaxy/src/runners/runners.service.ts, so widening later is a change in that one place once the allowed list can be read.

## What it costs to change later

Small if the allowed list becomes readable: the list given to the mint grows and a few tests change, and nothing stored changes. Undoing option C would be a security cleanup instead, though GitHub expires every token it mints within the hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD's done-when asks for the wider token but does not say which slice or follow-up migration opens the key's allowed repositories to the server
- (author) Whether a bug fix's pull request needs the product's other repositories at all in the first release of this feature
