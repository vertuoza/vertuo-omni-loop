---
id: s1-01-outsider-screen-in-the-shots
prd: 94
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The practice galaxy always signs you in with a Vertuoza account, so the screen for someone signed in from another company never shows there. How should the screenshot tool reach that screen?

## The decision, in plain words

For that one screen, the tool pretends inside its own browser that the practice account belongs to another company. Nothing in the game itself changes.

## The intro, for fun

Every arcade has one screen that almost nobody ever gets to see.

## The punchline, for fun

So the photographer sent in a stand-in with the wrong badge, just for the picture.

## The options, in plain words

A. Pretend inside the tool's own browser, for that one screen, that the practice account is from another company. This is what was built.
B. Add a practice-only switch to the game itself that signs in as someone from another company.
C. Leave that screen out of the screenshots and check it by hand.

## What I had to decide

How `pnpm galaxy:shots` reaches the `outsider` scene (WRONG CARTRIDGE). The demo account's guest is always `guest@vertuoza.com` with `crew: true`, so the demo flow never shows it, while the plan asks for a screenshot of every scene and s1's territory holds only the script, the package files, the gitignore and the README.

## What I did meanwhile

A second browser context per size intercepts the dev server's `/_next/static/**/*.js` chunks and rewrites the demo guest (`guest@vertuoza.com`, `crew: true`) to `guest@example.com`, `crew: false`. It signs in, goes back to the title through GitHub link (B) and the menu (B), and presses START, which opens `outsider`. If no chunk held the guest, the run says so, lists `outsider` as missed and exits 1.

## What it costs to change later

Deleting one walk and one route handler in `apps/galaxy/scripts/shots.mjs`. Option B is a small demo-only switch in `src/arcade/account-demo.ts` plus a one-line change to the walk.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the rewrite still matches a minified production build: it was run against `pnpm galaxy:dev` only (author)
