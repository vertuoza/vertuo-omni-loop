---
id: s1-02-key-last-token-label-stops
prd: 2573
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

An API key that holds its own GitHub App shows in Settings when that App last made a token for a job. Now that every job runs as the Omni App, should that date keep moving?

## The decision, in plain words

It stops moving: the key's own App makes no token any more, so its last date stays the last time it really did. The App, its form and its stored rows stay as they are.

## The intro, for fun

A date in Settings used to tick with every job.

## The punchline, for fun

Now it remembers the last time the key's App really worked.

## The options, in plain words

A. A. The key's last token date stops moving, since the key's App makes no token.
B. B. Keep moving it for every job the key sends, though the Omni App made the token.
C. C. Hide the key's App section in Settings until a later PRD decides its fate.

## What I had to decide

Whether the key's last token date in Settings should keep moving for jobs that now run as the Omni App.

## What I did meanwhile

The runner service no longer calls api_key_github_app_minted(): the key's last_token_at keeps its last value. The repository method stays, unused, with the rest of the key's App.

## What it costs to change later

A constant: one call in the service. Restoring it means calling the record again after each Omni App mint for a key's job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the person wants the label hidden or reworded while the key's App is unused; this slice leaves the Settings screen untouched.
