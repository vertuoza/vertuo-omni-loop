---
roadmap: 1799
title: Governed knowledge
milestone: Every knowledge entry declares the least review a decision on it needs, owners and their fallbacks are named, the knowledge base holds legal obligations, domain contracts and a glossary, and agents walk it as a graph from the CLI or the server.
source: https://claude.ai/code/artifact/67d99a28-a887-46ab-b481-c586c4eadc5b
---

## PRDs

| id | PRD | title | blocked by | why | wave |
|---|---|---|---|---|---|
| P1 | #1793 | The briefing is a risky change | – | – | 1 |
| P2 | #1794 | An unanswered owner escalates to a delegate, never to an auto-approve | – | – | 1 |
| P3 | #1795 | Product knowledge on the Omni page: Legal and Glossary | – | – | 1 |
| P4 | #1796 | Domain contracts as pointer entries | – | – | 1 |
| P5 | #1797 | The knowledge graph from the CLI | P3, P4 | the graph walks the Legal and Glossary links P3 adds and the Points-to links P4 adds, so it covers every link from day one | 2 |
| P6 | #1798 | The knowledge graph API on the server | P5 | it publishes the graph P5 builds, reusing its JSON shape as the contract | 3 |

## Open questions

| id | question | recommendation | blocks | kind |
|---|---|---|---|---|
| Q1 | Who approves changing a business rule? | Keep the tiers PRD 1726 shipped: a rule through a high item any person answers, a locked law only through its CODEOWNER; no review-policy line per entry. | P1 | default |
| Q2 | What does escalation cover, and where is the delegate kept? | Locked-law approvals and high items; a delegate next to each owner in laws.owners. | P2 | default |
| Q3 | How long before an unanswered item escalates? | 2 working days, a setting of its own. | P2 | default |
| Q4 | Where are Legal entries and the glossary kept? | Per product, on the product's Omni page, read by every repository of the product through the CLI. | P3 | default |
| Q5 | Who edits a product's Legal and Glossary entries? | Named owners per product, each with a delegate; other members propose. | P3 | default |
| Q6 | What does the knowledge check do when the Omni page cannot be reached? | Pass with a note, using the last copy read; never block on the network. | P3 | default |

## Prerequisites

| id | category | need | check | fix | blocks | who |
|---|---|---|---|---|---|---|
| p1 | permissions | gh is signed in, with the right to change the repository | `base:gh-auth` | | all | check |
| p2 | local | Node 22.18 or newer is installed | `base:node` | | all | check |
| p3 | local | pnpm is installed, at the version the repository pins | `base:pnpm` | | all | check |
| p4 | access | the libraries install from the lockfile | `base:install` | `base:install` | all | agent |
| p5 | github | the loop's labels exist on GitHub | `base:labels` | `base:labels` | all | agent |
| p6 | local | Docker is running, for the database checks of the product knowledge and the graph API | `base:docker` | | P3, P6 | check |

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

- **Why:** The product knowledge (P3) and the graph API (P6) add database tables, and their access checks run against a local database inside Docker. Without Docker running, those checks cannot run on this laptop.
- **Command:** `open -a Docker`
- **What it does:** Starts the Docker app on your Mac. If it is not installed, get it from https://www.docker.com/products/docker-desktop and open it once.
- **Who can do it:** Anyone with this laptop.
