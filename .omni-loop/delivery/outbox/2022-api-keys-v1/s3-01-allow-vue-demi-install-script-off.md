---
id: s3-01-allow-vue-demi-install-script-off
prd: 2022
slice: s3
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

The viewer that draws the API reference pulls in a small helper whose install step pnpm refuses to run unasked, which fails every install. Should we tell pnpm to leave that step off?

## The decision, in plain words

The repository's pnpm settings now say the helper called vue-demi never runs its install step, so installs stay green.

## The intro, for fun

A helper arrived with a to-do list; we politely declined the list.

## The punchline, for fun

It does its job fine without ever being asked to set up.

## The options, in plain words

A. A. Turn vue-demi's install step off in the pnpm settings (built).
B. B. Draw the reference with a script from a public CDN instead, and drop the viewer package.

## What I had to decide

Adding Scalar's viewer made pnpm stop with ignored build scripts for vue-demi, which would fail the install in CI. One line in the pnpm settings file, outside this slice's usual folders, turns that step off; the helper works without it. Undoing it is deleting the line, with the viewer removed.

## What I did meanwhile

Installs pass; the reference viewer works.

## What it costs to change later

One line in pnpm-workspace.yaml.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether vue-demi's script is needed by a Vue version this repository does not use is unverified (author).
