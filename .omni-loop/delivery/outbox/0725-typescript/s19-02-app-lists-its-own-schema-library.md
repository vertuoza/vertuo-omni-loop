---
id: s19-02-app-lists-its-own-schema-library
prd: 725
slice: s19
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The GitHub App now checks what GitHub sends it with the same checking library the rest of the repository uses. Should the App name that library as its own dependency, which touches the shared list of installed versions?

## The decision, in plain words

The App names it, at the exact version already installed for the rest of the repository, so nothing new is downloaded and nothing else changes version.

## The intro, for fun

The App borrowed a library from its neighbours and never said thank you.

## The punchline, for fun

Now it is on the App's own shopping list, same brand, same price.

## The options, in plain words

A. A. The App names the library itself, at the version already installed; nothing else changes
B. B. Leave the App's list alone and keep borrowing the library from the repository, with the audit warning left standing
C. C. Check the App's data only through the kit's own checks, so the App never uses the library directly

## What I had to decide

PRD 725 asks every value the App reads from GitHub, Inngest or a webhook delivery to pass a Zod schema. apps/omni-app imported zod nowhere before this slice, and its package.json did not list it: the import resolved only because the root package lists zod and pnpm links it there. fallow's audit reports that as an unlisted dependency of apps/omni-app. package.json of the App and pnpm-lock.yaml are outside s19's territory.

## What I did meanwhile

apps/omni-app/package.json lists "zod": "^4.6.5", and pnpm-lock.yaml gains the three lines of that importer entry only, resolved to the zod 4.6.5 already locked for the root and the arcade. `pnpm install --frozen-lockfile` (pnpm 9, as CI runs it) accepts the lockfile, and no other version moves. A plain `pnpm install` was tried first and refused: it re-resolved inngest's TypeScript peer to 7.0.2.

## What it costs to change later

Cheap: drop the line from the App's package.json and the three lockfile lines, and leave the import resolving through the root as before.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s20, which also opens schemas in apps/omni-app, adds the same line, so the wave merge sees it twice
- (author) Whether Vercel's build of the App installs with --frozen-lockfile, which would refuse a lockfile edited by hand if it were wrong
