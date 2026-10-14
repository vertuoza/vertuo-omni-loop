---
screen: runners
status: draft
kind: page
mock: runners.html
implements: [apps/galaxy/app/app/runners/page.tsx, apps/galaxy/src/runners/page/RunnersPage.tsx, apps/galaxy/src/runners/page/runners.css]
reads: [apps/galaxy/src/runners/page/Terminal.tsx, apps/galaxy/src/runners/runners.contract.ts, apps/galaxy/src/runners/runners.service.ts, apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/sidebar.ts]
routes: [/app/runners]
supersedes: null
---

## Purpose

The workspace's runners and the jobs sent to them: which machines are online, what each one is
running, and where each job ended, with its pull request and a Terminal that shows its live log
(the `runner-terminal` screen, PRD 1904). A workspace owner gives
a runner to a fleet here. It sits inside the app shell, a shared screen of its own, `app-shell`.

## Regions

- **The title,** Runners.
- **Runners:** one row per runner, with:
  - its name and state (Online, Busy, Offline with when it was last seen);
  - its fleet, a picker for a workspace owner and plain text for everyone else;
  - slots used out of slots, its repositories and the kit version;
  - a Terminal button, opening its running job, else its last job; disabled, titled "No job yet",
    when it has run none.
- **Jobs:** queued and running first, then the last 50 that ended. Each row shows the line, the
  repository, who sent it, where it went, its status and its action.
  - Each row has a Terminal button, which opens the `runner-terminal` panel on that job and sets
    `?terminal=<job id>` on the URL.
  - A done job links its pull request.

## States

- **No runner yet:** the page says how to start one, with `omni runner --name <name> --repos <dir>`
  to copy.
- **A job's status:** Queued, Running with its time, Done, Failed with its reason (`runner lost`,
  `timeout`, the exit code), Cancelled.
- **A viewer who is not an owner:** each fleet reads as text, with no picker.
- **Refresh:** the rows are read again every 5 seconds while the page is open.

## Words

Runners · Runner · State · Online · Busy ·
Offline · Fleet · Shared · Slots · Repositories · Kit · Jobs · Line · Repository · Sent by · Where ·
Any runner · Status · Queued · Running · Done · Failed · Runner lost · Timeout · Cancelled ·
Cancel · Send again · Terminal · No job yet.

## Refusals

- No free-text prompt: a job is only a line the app copies, from the list of skills a runner may run.
- No job runs again by itself: Send again is a person's press.

## Open questions

- Is Send again the page's one primary action, or does the page have none while nothing failed?
- Does a member see the jobs of fleets they are not in, or only their own fleet's and the shared
  ones?

## Source

/omni:brainstorm, PRD 1830: .omni-loop/delivery/shipped/1830-runners/before-after.html
/omni:brainstorm, PRD 1904: .omni-loop/delivery/shipped/1904-runner-live-logs/before-after.html
