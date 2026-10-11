---
id: s1-02-token-workspace
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

A terminal token acts in one workspace, but a person can belong to several, and the plan does not say which one a token made from the terminal belongs to.

## The decision, in plain words

The page that starts the sign-in may name the workspace. When it names none, the token belongs to the first workspace the person joined.

## The intro, for fun

A person in three workspaces makes one token, and the token has to live somewhere.

## The punchline, for fun

Without a name on the envelope, it goes to the first address on file.

## The options, in plain words

A. A. The workspace the sign-in names, else the person's first one (built)
B. B. The workspace of the repository the terminal runs in, required
C. C. Ask the person on the sign-in page when they are in several

## What I had to decide

Keep the first workspace the person joined as the default, or say the terminal must always name one.

## What I did meanwhile

Tokens made from the terminal belong to the person's first workspace; the profile page can name its own.

## What it costs to change later

A rule in one database function and an optional field of the sign-in link; changing it touches no stored token.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The terminal's command (slice s3) may want to pass the workspace of the repository it runs in; that is its choice (author)
