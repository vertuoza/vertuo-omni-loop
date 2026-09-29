---
id: s1-02-push-cap-kept-at-two-mib
prd: 627
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

A visual fix now sends its before and after page and every round of looks at once. Should one send be allowed to carry more than it does today?

## The decision, in plain words

The limit on one send stays as it is today, about four big pages. A visual fix whose page and rounds together go past it is refused as a whole and the terminal says so; nothing else changes.

## The intro, for fun

Every round of looks rides in one envelope to the Omni page.

## The punchline, for fun

The envelope did not grow; most looks travel light anyway.

## The options, in plain words

A. Keep one send at 2 MiB for every kind (built).
B. Raise the limit to about 4 MiB, what the hosting accepts for one call.
C. Keep the limit and have the kit send a large fix's rounds in several sends.

## What I had to decide

Whether to raise the limit on one send for fixes (up to what the hosting takes, about 4 MiB), or split a large fix into several sends.

## What I did meanwhile

A send over the limit is refused with 'refused (413)' in the terminal and the fix's page is not updated; each page stays under its own 512 KiB limit as before.

## What it costs to change later

Raising it is one constant in the page's server and one in its tests; splitting sends is a small change in the kit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No real visual fix has sent more than one round yet, so how large rounds get in practice is not known.
