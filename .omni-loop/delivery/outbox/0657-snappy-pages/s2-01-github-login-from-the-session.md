---
id: s2-01-github-login-from-the-session
prd: 657
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The quick sign-in check no longer returns the list of accounts a person linked. Where should the app find their GitHub name now?

## The decision, in plain words

The app reads the GitHub name from the profile details the session already carries, which GitHub sign-in fills with the same name.

## The intro, for fun

The fast badge check at the door does not list every club card in your wallet.

## The punchline, for fun

So we read the name printed on the badge itself, which says the same thing.

## The options, in plain words

A. A: read the GitHub name from the session's profile details (built).
B. B: when the profile details carry no GitHub name, ask the sign-in service for the full account once per request.
C. C: always ask the sign-in service for the full account in the page, as before, and only speed up the check at the door.

## What I had to decide

Whether the GitHub name read from the session's profile details is good enough, or whether pages should ask the sign-in service for the full account when a name is missing.

## What I did meanwhile

The name comes from the session's profile details for a GitHub sign-in; an account with no GitHub name there shows no login, as an account with no linked GitHub did before.

## What it costs to change later

Low: one small function builds the person from the session, and swapping it back to a full account read is a few lines, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not checked against a live production session that the profile details carry the GitHub name for every existing account (author).
