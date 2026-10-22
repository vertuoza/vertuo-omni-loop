---
id: s4-01-pair-checked-before-owner
prd: 2433
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When someone sends an App ID and a private key to attach to an API key, should the server ask GitHub whether the pair is valid before the database says whether that person may attach it at all?

## The decision, in plain words

Yes: the server checks the pair with GitHub first, then the database decides who may attach it. Nothing the server can read tells it which workspace a key belongs to before that, so an owner check cannot come first without a new read or a new field.

## The intro, for fun

Knocking on GitHub's door before asking who owns the house.

## The punchline, for fun

The database still decides who may stay, and GitHub only vouches for the key.

## The options, in plain words

A. A. Check the pair with GitHub first, then let the database refuse anyone who may not attach it, so the request stays exactly as the spec words it.
B. B. Add a small database read that says whether the caller owns a key's workspace, and ask it before GitHub is called, which adds a migration to this slice's sibling.
C. C. Ask the sender to name the workspace as well as the key, check ownership first with the read the page already uses, then ask GitHub, which changes the request the spec words.

## What I had to decide

The spec sends only the App ID and the private key, with the key's id in the path, and the database function that attaches (api_key_github_app_attach) needs the App's slug and its bot's id, which only GitHub can give, and it is the function that refuses a member or another workspace's owner. No read maps a key's id to its workspace for the caller, so I put the GitHub check first and the database's refusal second.

## What I did meanwhile

attachGithubApp in keys/api-keys.service.ts checks the pair (two read-only GitHub calls), seals the private key under the master key and calls the database function; a member or a stranger gets 403, a revoked key 404, a pair GitHub refuses 422, GitHub down 502 and a deployment with no master key 503, and nothing is stored in any of them. A pair a non-owner sends is used for those two calls and nowhere else: never stored, logged or answered.

## What it costs to change later

Small. Naming the workspace in the request, or adding a database read of a key's workspace, moves the owner check ahead of GitHub in a few lines of the service and the controller; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a member's pair reaching GitHub for two read-only calls is acceptable, or the owner check must always come first (author)
