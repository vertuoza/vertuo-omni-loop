---
id: s7-02-roadmap-park-links-the-issue
prd: 1162
slice: s7
rank: medium
bears-on: none
raised: 2026-10-07
wave: 4
---

## The question, in plain words

When a project of a roadmap waits on a person's answer, the loop should point at the roadmap's page, but it only knows the roadmap's issue on GitHub. Where should it point?

## The decision, in plain words

The loop points at the roadmap's issue, where an answer is left, and its line names the question and the one command that answers it. A project whose earlier project was closed without merging points at that closed pull request.

## The intro, for fun

A question with no address is a letter with no envelope.

## The punchline, for fun

So the loop writes the issue on the envelope, and the reply finds its way.

## The options, in plain words

A. A. Link the roadmap's issue and name the answer command; spec wording for a closed blocker (built)
B. B. Read the page's address from the app on each tick, with the sign-in, and link the page
C. C. Link the roadmap list page of the app, which every roadmap can be reached from

## What I had to decide

The spec says a `person` question parks its PRDs "naming the question and the roadmap's page", but the page's id is the app's (`omni roadmap push` learns it from the reply); `omni next` calls no app. Also open: what a tick does when the kept loop plan drives other PRDs, and what a closed blocker's line names in a plan repository.

## What I did meanwhile

The park reads `waits on a person: roadmap <n> question <Q> is not answered (<question>); answer it with omni roadmap answer <n> <Q> "<answer>"`, linking `https://github.com/<slug>/issues/<n>`; answers GitHub cannot read leave the question unanswered. A closed blocker parks with the spec's `blocker #<pr> closed unmerged: fix the roadmap`, linking that PR. `omni next --roadmap <n>` follows the kept plan when it drives the roadmap's PRDs, else makes version 1 for them, replacing the kept one, as a tick with no plan kept does. Only a PRD's first step is held on its blockers.

## What it costs to change later

Small: a page link is one argument once `omni next` can read the roadmap's id (or the app serves a page by repository and number); the closed line is one string.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page should be reachable by repository and roadmap number, so a terminal could link it without asking the app.
- (author) In a plan repository `#<pr>` alone does not say which repository the closed PR is in; the link does.
