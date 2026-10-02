---
id: s6-03-two-edits-outside-territory
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing this slice's folders needed two small edits in files other slices own. Should they go in here, or wait for those slices?

## The decision, in plain words

Both went in here, each kept to a few lines, so the folders reach zero without waiting.

## The intro, for fun

Tidying one room meant moving a chair in the hallway.

## The punchline, for fun

The chair stands where it stood, only facing the right way.

## The options, in plain words

A. Make both edits here, kept minimal, and say so.
B. Leave the fake server loosely typed and the unreadable file counted, for the owning slices to clear.
C. Reopen the owning slices to make the edits there.

## What I had to decide

Typing the fake ask server's bodies as unknown broke kit/bin/business.test.ts (s3's area), whose handler type accepted a `(repo: string)` function only because `Json` was `any`. And packages/galaxy/src/index.d.ts could not be parsed by the linter's project service, which only eslint.config.ts (s2's file) can change.

## What I did meanwhile

kit/bin/business.test.ts's Checkout type names what each handler receives (`business` the repository, `cite` and `claim` the body) and drops the Json import. eslint.config.ts gives the project service `allowDefaultProject: ['packages/galaxy/src/index.d.ts']` with `defaultProject: 'tsconfig.json'`. Both areas still lint at zero.

## What it costs to change later

A constant: two lines in business.test.ts and five in eslint.config.ts, each revertable on its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives each slice its territory and says a change outside it is a decision; it does not say whether one is welcome once the owning slice has merged.
