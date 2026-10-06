---
id: s5-03-provider-name-guard
prd: 1108
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

What exactly counts as a provider's name appearing where it should not?

## The decision, in plain words

No code may load a provider directly except the list of providers, and inside the providers' own folder no file but its own, its test and that list may write its name. A product's settings may still name a provider, since that is a choice the product makes, and an unknown one falls back with one line.

## The intro, for fun

We wanted a provider's name to be a secret, then remembered the settings page has to say it out loud.

## The punchline, for fun

So the secret is kept from the code, not from the people choosing.

## The options, in plain words

A. A. Forbid loading a provider directly anywhere, and writing its name inside the providers' folder.
B. B. Also forbid writing a provider's name anywhere in the kit, settings included.
C. C. Only forbid loading a provider directly.

## What I had to decide

Whether the check should also forbid a provider's name everywhere else in the kit, which would make the settings take their default choices from the list of providers.

## What I did meanwhile

The check stops any code that loads a provider directly, and any provider file that names another one.

## What it costs to change later

Widening the check later is a few lines in one test, plus moving the settings' default choices behind the list of providers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The settings slice is built at the same time and writes default provider names as data; the narrower check leaves it free to do so (author).
