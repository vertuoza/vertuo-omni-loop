---
id: s1-02-playwright-pinned-to-1-56
prd: 94
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Which version of the browser robot that takes the screenshots should the project use?

## The decision, in plain words

We use an older version, the one whose browser is already installed where our coding agents run, rather than the newest one.

## The intro, for fun

Robots age too, and this one is a little set in its ways.

## The punchline, for fun

It still takes a fine picture. It just insists on bringing its own camera.

## The options, in plain words

A. Keep the older version whose browser the agents' machines already have. This is what was built.
B. Move to the newest version, and install its browser on the agents' machines too.

## What I had to decide

The `playwright` devDependency of `@omni/galaxy-app`. The spec names Playwright but no version.

## What I did meanwhile

`playwright` `~1.56.1`, whose Chromium build (1194) is the one pre-installed where the loop's agents run, so the agents take screenshots without `playwright install`. A person installs Chromium once with `pnpm --filter @omni/galaxy-app exec playwright install chromium`, the step the README gives, whatever the version.

## What it costs to change later

One version in `apps/galaxy/package.json` and a `pnpm install`, then one `playwright install chromium` on each machine that runs the shots.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the agents' machines will move to a newer Chromium build (author)
