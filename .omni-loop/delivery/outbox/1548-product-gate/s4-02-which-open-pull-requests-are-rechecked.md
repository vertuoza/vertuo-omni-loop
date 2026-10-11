---
id: s4-02-which-open-pull-requests-are-rechecked
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When a product PRD is approved or voided, the GitHub app re-checks the PRD's open pull requests without asking GitHub for a list. Which pull requests does it look at?

## The decision, in plain words

Every open pull request the web app last recorded in the product's repositories. The app reads each one once and re-checks only those whose description names the PRD.

## The intro, for fun

No list from GitHub means we go through our own notebook, page by page.

## The punchline, for fun

One quick peek per pull request, and only the ones wearing the PRD's name tag get re-checked.

## The options, in plain words

A. Every open recorded pull request of the product's repositories, each read once (built).
B. Only the open ones Omni-man signed, into the default branch.
C. Store each pull request's PRD when the collector reads it, and read no pull request at all.

## What I had to decide

Confirm the candidates are the rows of pull_requests (the prStats collector's, PRD 612) with neither merged_at nor closed_at, in every repository product_repositories lists for the PRD's product, in its workspace, each read with one GET of that pull request (its body and head) through the workspace's github_installation_id; or narrow it (signed only, base the default branch only) or widen it.

## What I did meanwhile

apps/omni-app/src/server-event/targets.ts reads dossiers, products, workspaces, product_repositories and pull_requests as the service role; apps/omni-app/src/server-event/recheck.ts reads each pull request once, keeps those whose body says Part of <key>-<n>, and sends one approved check event per kept pull request, which the approved check posts with its own verdict. A repository the collector does not track, or a pull request opened since its last 15-minute run, is not re-checked by the event; its next webhook posts the check.

## What it costs to change later

Narrowing or widening the candidates is one query in targets.ts. Reading the installation per repository instead of per workspace is one App call per repository.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the event lists target PRs from pull_requests, not which of them; pull_requests keeps no body, so which are a PRD's own can only be read from GitHub, one pull request at a time.
