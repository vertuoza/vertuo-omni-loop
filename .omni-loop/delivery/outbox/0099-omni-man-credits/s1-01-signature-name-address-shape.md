---
id: s1-01-signature-name-address-shape
prd: 99
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a repository renames who signs the loop's work, should the kit accept any name and address, or refuse one that would break the signature line?

## The decision, in plain words

The kit refuses a name or an address that holds a line break or an angle bracket, and says which one, because either would break the line that credits the signer. Anything else is accepted, and the footer is free text.

## The intro, for fun

A signature is a small thing until someone puts a line break in it.

## The punchline, for fun

Angle brackets belong around the address, not inside the name.

## The options, in plain words

A. Refuse a name or address holding a line break or an angle bracket, and accept anything else, the option built.
B. Accept any non-empty name and address, and let a broken signature line go out as written.
C. Also require the address to look like an e-mail address, refusing more configs.

## What I had to decide

How strict the `signature` config section is about `name` and `email`. The spec (The signature) says an unknown key under `signature` is refused, as everywhere in the config, and that `omni sign trailer` prints `Co-authored-by: <name> <email>`; it says nothing about what a name or an address may hold. A name like `Omni <Man>` or an address with a newline would make `omni sign trailer` print a line no git or GitHub reader takes for a co-author, and `omni phase0` would then look for that broken line.

## What I did meanwhile

`kit/lib/config.mjs`: `signature.name` and `signature.email` must be non-empty, one line, with no `<` or `>` (`trailerPart`); a violation is a config error naming `signature.name` or `signature.email`, like any other bad key. `signature.footer` only has to be non-empty. Tested in `kit/lib/config.test.mjs` (the signature section block).

## What it costs to change later

One regular expression in `kit/lib/config.mjs` and one test. Loosening it later breaks no config that parses today; tightening it further (say, a real e-mail shape) could refuse a config a repository already wrote.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a repository may sign with a name or an address that is not a valid co-author line, or whether the kit should check the address is an e-mail at all.
