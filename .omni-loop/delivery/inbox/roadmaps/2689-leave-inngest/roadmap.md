---
roadmap: 2689
title: Leave Inngest
milestone: Every background job of the Omni GitHub App runs on its own job ledger, and the App no longer depends on Inngest.
---

## PRDs

| id | PRD | title | blocked by | why | wave |
|---|---|---|---|---|---|
| P1 | #2684 | PR checks on the job ledger | – | – | 1 |
| P2 | #2685 | Scheduled and short jobs on the job ledger | P1 | P1 replaces the webhook's send to Inngest with ledger adds, the path the fix row stamp and fleet board jobs are added on, and gives the lane and the minute sweep the schedule runs on | 2 |
| P3 | #2686 | Long-running jobs on the job ledger | P2 | the retro's 14-day wait and the main watch's daily look use the `later` outcome and the job's progress that P2 adds | 3 |
| P4 | #2687 | Remove Inngest | P3 | the package and /api/inngest can go only once no function is left on Inngest | 4 |

## Open questions

| id | question | recommendation | blocks | kind |
|---|---|---|---|---|
| Q1 | How does the ledger debounce? | one queued job per check and pull request; a new event pushes it 5 seconds later, at most 1 minute after the first; an event that arrives while it runs adds one more run | P1 | default |
| Q2 | How does a check run within seconds when the sweep runs every 15 minutes? | the webhook waits the window out in `waitUntil` and runs the jobs due; the sweep moves to every minute as the safety net | P1 | default |
| Q3 | Are a job's steps saved between tries? | no for the checks and the short jobs, which re-run whole; only P3's jobs save steps | P1, P2 | default |
| Q4 | How does a job wait days, or for an event? | it keeps its finished steps in its row and goes back to `queued` with a later date; a CI result makes it due now | P3 | default |
| Q5 | What happens to the runs Inngest holds at the switch? | nothing is read from Inngest; each PRD's comparison rebuilds what is owed from our tables and GitHub | P2, P3 | default |

## Prerequisites

| id | category | need | check | fix | blocks | who |
|---|---|---|---|---|---|---|
| p1 | permissions | gh is signed in, with the right to change the repository | `base:gh-auth` | | all | check |
| p2 | local | Node 22.18 or newer is installed | `base:node` | | all | check |
| p3 | local | pnpm is installed, at the version the repository pins | `base:pnpm` | | all | check |
| p4 | access | the libraries install from the lockfile | `base:install` | `base:install` | all | agent |
| p5 | github | the loop's labels exist on GitHub | `base:labels` | `base:labels` | all | agent |
| p6 | local | Docker is running, for the database checks of the job ledger | `base:docker` | | P1, P2, P3 | check |
| p7 | access | this laptop is signed in to the Omni page, to send each PRD's dossier | `base:omni-signin` | | all | check |

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

### p6

- **Why:** P1, P2 and P3 each change the job ledger's database functions, and their checks run against a local database inside Docker. Without Docker running, those checks cannot run on this laptop.
- **Command:** `open -a Docker`
- **What it does:** Starts the Docker app on your Mac. If it is not installed, get it from https://www.docker.com/products/docker-desktop and open it once.
- **Who can do it:** Anyone with this laptop.

### p7

- **Why:** Each PRD's spec, plan and before/after page are sent to its page on Omni as you. Without a sign-in, the dossiers cannot be sent.
- **Command:** `node .omni-loop/bin/omni.mjs signin`
- **What it does:** Opens the Omni page in your browser so this laptop can sign in to your workspace.
- **Who can do it:** Anyone with this laptop who is a member of the workspace.
