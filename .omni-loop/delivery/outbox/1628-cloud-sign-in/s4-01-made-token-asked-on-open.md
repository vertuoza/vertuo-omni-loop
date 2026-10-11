---
id: s4-01-made-token-asked-on-open
prd: 1628
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

How does your profile page know, after the sign-in comes back, that a new token is waiting to be shown?

## The decision, in plain words

Your own profile asks once each time it opens whether a token is waiting; almost always the answer is no and nothing shows. The address coming back carries no mark, because the sign-in only accepts a plain way back.

## The intro, for fun

The page knocks on the token's door every time it walks past.

## The punchline, for fun

Usually nobody answers, and that is fine.

## The options, in plain words

A. A. Ask once on every open of your own profile, the option built.
B. B. Let the way back carry a marker (a change to the sign-in), and ask only then.
C. C. Have the page's server read the waiting token itself, widening where its cookie is sent.

## What I had to decide

Whether your own profile asks POST /api/ask/token/made once on every open, or only when the address it comes back to carries a marker, which s1's way-back rule (/app/... with no query) does not allow today.

## What I did meanwhile

TerminalTokens.tsx asks once per page on your own profile (a ref keeps React's double effect to one call); a 404 shows nothing. Someone else's profile and the demo never ask.

## What it costs to change later

A constant: the call moves behind a marker in a few lines once the way back allows one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- one extra small request on each open of your own profile (author)
