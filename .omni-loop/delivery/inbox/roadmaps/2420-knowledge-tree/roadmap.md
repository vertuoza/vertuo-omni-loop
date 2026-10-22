---
roadmap: 2420
title: Repository knowledge at the right level
milestone: Each kind of knowledge sits at the right level of one tree (Omni settings kept as a settings repository, plan repository, repository, each optional and each plain files), product knowledge read top-down and tech knowledge bottom-up, and AI agents get a strong, visible default for how to work, set once in the Omni settings.
---

## PRDs

| id | PRD | title | blocked by | why | wave |
|---|---|---|---|---|---|
| P1 | #2416 | One resolution order for the knowledge tree | – | – | 1 |
| P2 | #2417 | Tech defaults at the Omni-settings level | P1 | the defaults are the top level of the tech side, read through P1's order | 2 |
| P4 | #2418 | Product decisions top-down | P1 | it uses P1's top-down order and contradiction check | 2 |
| P3 | #2419 | The knowledge tree on the Omni page | P1, P2 | it draws the levels P1 resolves and the defaults P2 adds | 3 |

## Open questions

| id | question | recommendation | blocks | kind |
|---|---|---|---|---|
| Q2 | How does a repository read the settings repository's defaults offline? | a local read copy, refreshed by `omni sync` | P2 | default |
| Q3 | Who owns a playbook page? | an `owner:` line on the page, defaulting to the repository's law owners | P2, P3 | default |

## Prerequisites

| id | category | need | check | fix | blocks | who |
|---|---|---|---|---|---|---|
| p1 | permissions | gh is signed in, with the right to change the repository | `base:gh-auth` | | all | check |
| p2 | local | Node 22.18 or newer is installed | `base:node` | | all | check |
| p3 | local | pnpm is installed, at the version the repository pins | `base:pnpm` | | all | check |
| p4 | access | the libraries install from the lockfile | `base:install` | `base:install` | all | agent |
| p5 | github | the loop's labels exist on GitHub | `base:labels` | `base:labels` | all | agent |
| p7 | access | this laptop is signed in to the Omni page, to send dossiers and read the defaults | `base:omni-signin` | | P2, P3 | check |

### p1

- **Why:** The loop opens pull requests and reads issues on GitHub as you. It needs to be signed in, with the right to change the repository.
- **Command:** `gh auth login --scopes repo`
- **What it does:** Opens GitHub in your browser so you can sign the gh tool in, with the right to read and change your repositories.
- **Who can do it:** Anyone with this laptop and a GitHub account that can write to the repository.

### p2

- **Why:** The code runs on Node, and this repository needs version 22.18 or newer.
- **Command:** `brew install node`
- **What it does:** Installs the latest Node on a Mac. Without Homebrew, download it from https://nodejs.org and run the installer.
- **Who can do it:** Anyone with this laptop who can install apps on it.

### p3

- **Why:** This repository installs its code libraries with pnpm. Without it, nothing can be installed or tested.
- **Command:** `corepack enable pnpm`
- **What it does:** Installs pnpm on this computer, through Node, which is already there.
- **Who can do it:** Anyone with this laptop.

### p7

- **Why:** P2 and P3 send and read knowledge on the Omni page as you. Without a sign-in, the defaults cannot be read and the dossiers cannot be sent.
- **Command:** `node .omni-loop/bin/omni.mjs signin`
- **What it does:** Opens the Omni page in your browser so this laptop can sign in to your workspace.
- **Who can do it:** Anyone with this laptop who is a member of the workspace.
