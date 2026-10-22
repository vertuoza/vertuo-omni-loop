---
screen: runner-need-human
status: draft
kind: page
mock: runner-need-human.html
implements: [apps/galaxy/src/runners/page/NeedHuman.tsx, apps/galaxy/src/runners/page/need-human.ts, apps/galaxy/src/runners/page/need-human.css]
reads: [apps/galaxy/src/runners/runners.contract.ts, apps/galaxy/src/runners/page/Terminal.tsx]
routes: ['/app/runners?answer=<job id>']
supersedes: null
---

## Purpose

The drawer where a person answers a bug fix that stopped for a decision on a runner (PRD 2255): it
shows why the agent stopped and the questions it asked on its job, and Send answers queues the same
fix again, on the same target, with those answers. It opens over the Runners page from a job's
Need human button, or from the issue's link with `?answer=<job id>`.

## Regions

- **The header:** `Need human · <repo> · #<issue>`, the issue number linking the issue, and a close
  button.
- **The lead:** one paragraph from the agent, saying why it stopped.
- **The questions:** 1 to 4, each with its header, its text and 2 to 4 options, each option a label
  and a one-line description. The last option is always **Design it first**, "Stop here and
  brainstorm the behaviour". Options are picked one at a time, or several when the question allows
  it. Each question has a free answer of at most 2,000 characters.
- **The foot:** **Dismiss**, then **Send answers**, its one primary action.
- **Over the page:** it slides over the right side of the Runners page, as the Terminal panel does,
  the whole width on a phone; the page behind is dimmed.

## States

- **Open:** Send answers is disabled until every question has an answer (an option or a free answer).
- **Sending:** both buttons disabled until the server answers.
- **Sent:** the drawer closes, the job reads Done, and the resume job shows on the board, queued.
- **Refused:** the resume line or the target was refused; the drawer stays open with the service's
  words above the foot, and nothing is stored.
- **Closed by someone else:** `Already answered by <name>` or `Dismissed by <name>`, with neither
  button. Closed by an API key: `Already answered by API key <name>` or `Dismissed by API key
  <name>`, followed by ` · for <acting_for>` when the app said whom it acted for (PRD 2425).
- **Unknown job:** `?answer=` names a job that is not in the workspace or has no question; the
  drawer does not open.
- **Focus:** it moves inside the drawer on open, Tab stays inside it, and it returns to the button
  on close (Escape, the close button, a click on the dimmed page).

## Words

Need human · Design it first · Stop here and brainstorm the behaviour · Or your own answer ·
Dismiss · Send answers · Already answered by · Dismissed by · API key · for · Close.

## Refusals

- Nobody is notified: the drawer opens only when a person comes to it.
- No answer changes after it is sent (BR-PRODUCT-12): the first answer or dismissal wins.
- A runner's sign-in or a terminal token never answers or dismisses (BR-PRODUCT-94): only a
  person's session, or an API key of the workspace on a job a key sent, marked as the key's and
  never as a person's (PRD 2425; the sentence it proposes for the law awaits its owner).
- No resume of the stopped session: the answer always starts a new job.

## Open questions

- Should the drawer show who sent the first job and when it stopped?
- Should Dismiss ask for a reason?

## Source

/omni:brainstorm, PRD 2255: .omni-loop/delivery/shipped/2255-need-human/before-after.html
/omni:brainstorm, PRD 2425: .omni-loop/delivery/inbox/2425-api-key-job-control/before-after.html
