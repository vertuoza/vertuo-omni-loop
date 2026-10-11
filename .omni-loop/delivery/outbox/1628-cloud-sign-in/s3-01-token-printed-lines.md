---
id: s3-01-token-printed-lines
prd: 1628
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When the terminal hands back a new cloud token, how should it show it: on a line of its own as well as in the line to paste, or only in the line to paste?

## The decision, in plain words

The terminal shows the token on a line of its own, then the day it expires, then the line to paste, which carries the token a second time. Nothing else ever shows it again.

## The intro, for fun

A brand new key comes out of the machine, and it has to decide how many times to wave it at you.

## The punchline, for fun

Twice in one breath, then never again, like a magician who forgets the trick right after.

## The options, in plain words

A. A. Three lines: the token alone, its expiry, then the paste line, the option built.
B. B. Two lines: the expiry, then the paste line, so the token is printed exactly once.

## What I had to decide

Keep A, or pick B to print the token only inside the paste line (two lines instead of three).

## What I did meanwhile

omni setup-token prints three lines after the browser link: the token alone, 'It expires on <yyyy-mm-dd>.' (the expiry's UTC day), and 'Paste it as OMNI_TOKEN=<token> in your cloud environment's variables.'. The test pins those lines and sweeps every printed line so the token appears in no other.

## What it costs to change later

One constant line in kit/bin/commands/setup-token.ts and its test; the guide page (s5) quotes whatever lines are printed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the token, its expiry and the paste line as three things printed, and the paste line itself holds the token, so 'the token once' reads either as shown once in its life or as printed once in the output.
