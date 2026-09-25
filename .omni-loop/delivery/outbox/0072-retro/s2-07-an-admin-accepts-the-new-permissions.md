---
id: s2-07-an-admin-accepts-the-new-permissions
prd: 72
slice: s2
rank: human-action
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The retro needs the app to write its own branches, pull requests and issues and to read the build logs, which only an administrator of the organisation can grant. Will someone accept the new permissions?

## The decision, in plain words

Until they are accepted, each retro stops at its first write and leaves one comment on the merged pull request saying it could not run.

## The intro, for fun

The app got a promotion on paper, but its badge still only opens the front door.

## The punchline, for fun

Until an admin signs off, it knocks politely, leaves a note, and goes home.

## What a person must do

1. An organisation admin opens the omni-loop GitHub App's settings and updates its permissions to match the manifest: contents write, issues write, actions read.
2. On the vertuo-omni-loop installation, accept the new permissions GitHub asks for.

The app's README lists this as the first of the retro's human steps.

## What I had to decide

`app.yml` now asks for `contents: write` (was `read`), `issues: write` and `actions: read`. GitHub applies widened permissions only once an org admin updates the app's registration and accepts them on each installation.

## What I did meanwhile

The manifest and the README carry the new permissions. When a write is refused, the function's failure handler leaves one comment on the merged PR.

## What it costs to change later

None in code: retros that ran before the permissions were accepted failed, and can be replayed from Inngest afterwards.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the registered app already matches `app.yml` was not checked (author).
