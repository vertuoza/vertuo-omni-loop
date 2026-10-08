---
id: s2-01-install-check-and-fix-limit
prd: 1218
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

How should the agent tell that a repository's code libraries are installed, and how long may it spend installing them itself?

## The decision, in plain words

The check only looks for the folder of installed libraries, so it is quick. When it is missing, the agent installs them from the locked list, and may spend up to ten minutes doing it, longer than the thirty seconds a check gets.

## The intro, for fun

Installing everything just to check it installs is like baking a cake to see if the oven works.

## The punchline, for fun

So we peek inside the oven, and only bake when it is empty.

## The options, in plain words

A. A. The check looks for the installed folder; the fix installs within 10 minutes (built).
B. B. The check runs a full frozen install every time, with a longer limit of its own.
C. C. The check looks for the folder and also compares the lockfile with what was installed.

## What I had to decide

Whether the install check runs a full install from the lockfile (slow, but proves a private package is reachable) or only looks for the installed dependencies folder; and what time limit the install fix gets.

## What I did meanwhile

The base install check is ok when there is no package.json or when node_modules exists; its fix runs the package manager's frozen install (pnpm or yarn install --frozen-lockfile, npm ci) with a 10-minute limit (FIX_LIMIT_MS), while checks keep the 30-second limit. Reaching a private registry is the registry check's job (npm ping on every registry .npmrc names).

## What it costs to change later

A constant and one check function in kit/lib/roadmap/prereqs: no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the install check proves the dependencies install from a clean lockfile, which takes minutes, against a 30-second limit per check; it does not say how long a fix may run.
