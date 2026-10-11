---
id: s1-05-token-key-variable
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Each terminal token keeps a sign-in, locked with a secret key on the server. Should that be a new key of its own, or the key that already locks the workspaces' Jev keys?

## The decision, in plain words

A new key of its own, set beside the others, so losing it only means everyone makes a new token. It is listed in the arcade's setup guide, a file outside this slice's ground.

## The intro, for fun

One more key on the server's key ring.

## The punchline, for fun

Lose this one and only the terminal tokens have to be cut again.

## The options, in plain words

A. A. A separate key for terminal tokens, listed in the setup guide (built)
B. B. Share the key that already locks the Jev keys

## What I had to decide

Keep a separate key for terminal tokens, or share the existing secrets key.

## What I did meanwhile

Without the new key set on a deployment, no terminal token can be made or used there, and the server says so.

## What it costs to change later

Switching to the shared key is one line in galaxy; every token made under the other key would have to be made again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The arcade's setup guide was changed to list the variable, though it is outside this slice's territory: its variable check fails otherwise (author)
- The key has to be set on the hosted deployment before anyone can make a token (author)
