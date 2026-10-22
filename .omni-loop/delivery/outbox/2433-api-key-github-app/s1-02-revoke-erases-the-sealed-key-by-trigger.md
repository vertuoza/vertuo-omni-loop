---
id: s1-02-revoke-erases-the-sealed-key-by-trigger
prd: 2433
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When an API key is revoked, where should its sealed GitHub App key be erased: inside the revoke step made for API keys, or wherever any key gets revoked?

## The decision, in plain words

Wherever any key is revoked. A trigger on the key's revoked date erases the sealed key, so revoking through the API key step or through the general token step both erase it.

## The intro, for fun

Two doors lead to a revoked key, and only one had a guard.

## The punchline, for fun

Now the lock sits on the key itself, not on either door.

## The options, in plain words

A. Erase the sealed key from a trigger on the key's revoked date, so any way of revoking a key erases it.
B. Edit only the API key revoke step to erase the sealed key, and leave the general token revoke step able to leave it behind.
C. Edit both revoke steps, and make the general one refuse an API key so there is one single way to revoke it.

## What I had to decide

The spec says revoking the key deletes its App's row. Two functions revoke an api-scope key: api_key_revoke(), made for API keys, and agent_token_revoke(), made for every token scope and still callable by an owner with an API key's id. Editing only api_key_revoke() would leave the sealed private key behind when the other one is used.

## What I did meanwhile

A trigger on agent_tokens, after an update of revoked_at that turns null into a date, deletes the row. api_key_revoke() is not edited, so its checks and the migration that defined it stay as they are. supabase/checks/api_key_github_apps.sql proves the erase for both functions.

## What it costs to change later

Small. One follow-up migration drops the trigger and its function and moves the delete into the revoke function instead; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the general token revoke should refuse an api-scope key outright, which would leave a single way in (author)
