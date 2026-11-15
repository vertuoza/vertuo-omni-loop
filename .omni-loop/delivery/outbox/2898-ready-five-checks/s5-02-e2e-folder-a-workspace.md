---
id: s5-02-e2e-folder-a-workspace
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
excuses: [pnpm-workspace.yaml]
---

## The question, in plain words

The end-to-end test tool needs a home with its own list of packages, and the plan let this slice change that folder but not the file that names the parts of the repository. May that file name the new folder too?

## The decision, in plain words

Yes. The test folder is declared as one more part of the repository, with one added line, the way the kit's own guide for end-to-end tests says to set it up.

## The intro, for fun

A new room in the house needs a line on the floor plan.

## The punchline, for fun

One line, and the movers know where the boxes go.

## The options, in plain words

A. Declare the test folder as a part of the repository, with one line in the file that lists them: what was built.
B. Install the test tool with the repository's own packages instead, and keep only its settings in the test folder.

## What I had to decide

The spec says the e2e package is installed with its config in `e2e/`, and the plan gives s5 `e2e/`, `package.json` and `pnpm-lock.yaml`, but not `pnpm-workspace.yaml`. pnpm reads its workspaces only from `pnpm-workspace.yaml`, and `/omni:validate-e2e` (step 4) declares `e2e.dir` a workspace with its own `package.json`, since the dependency gate refuses a folder with its own manifest that is not one. Installing the framework in the root `package.json` instead would keep the edit inside the territory, but `/omni:validate-e2e` would then find no `e2e/package.json` and set the project up again.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Added `- 'e2e'` to the `packages` of `pnpm-workspace.yaml`, beside a comment; `e2e/package.json` is `@omni/e2e`, with `e2e`, `@e2e-dev/web`, `@e2e-dev/html-reporter`, `@openrouter/ai-sdk-provider` and `ai` at exact versions. The lockfile gained the new workspace's lines; its existing peers resolved to `@opentelemetry/api` 1.9.0, a version the lockfile already held.

## What it costs to change later

One line in `pnpm-workspace.yaml` and the workspace's lockfile lines; moving the framework to the root `package.json` instead is a few lines there and a reinstall.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the maintainers want the e2e framework installed on every machine that installs the repository, as a workspace makes it
