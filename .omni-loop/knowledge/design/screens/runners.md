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
(the `runner-terminal` screen, PRD 1904), and the drawer where a person answers a bug fix that
stopped for a decision (the `runner-need-human` screen, PRD 2255). A workspace owner gives
a runner to a fleet here. It sits inside the app shell, a shared screen of its own, `app-shell`.

## Regions

- **The title,** Runners.
- **Runners:** one row per runner, with:
  - its name and state (Online, Busy, Offline with when it was last seen);
  - its fleet, a picker for a workspace owner and plain text for everyone else;
  - slots used out of slots, its repositories and the kit version;
  - a Terminal button, opening its running job, else its last job; disabled, titled "No job yet",
    when it has run none;
  - under it, a health line (PRD 2102): four gauges, CPU (percent and `load <n> / <cores>`),
    Memory (`<used> of <total> GB`), Disk (`<free> GB free of <total>`) and Tokens
    (`<n> in 5 h · <n> today`, the four-count split in its title), each with the last hour's
    sparkline; a gauge past the runner's own limit reads in `--ask-red`.
  - under the health line, its account chips (PRD 2537), in the order its accounts file lists them:
    the account's id, in the ink colour when ready, in `--ask-plasma` when active, in `--ask-red`
    when out or unusable, each titled with its agent and its state (`out until 18:00`, `not signed
    in`). A runner with no accounts file shows none.
- **Jobs:** queued and running first, then the jobs waiting for an answer whatever their age
  (PRD 2255), then the last 50 that ended. Each row shows the line, the
  repository, who sent it, where it went, its status and its action.
  - Each row has a Terminal button, which opens the `runner-terminal` panel on that job and sets
    `?terminal=<job id>` on the URL.
  - A job whose line names a PRD of its repository shows, under the line, `PRD <n>` linking the
    PRD's page, then its title (PRD 2251).
  - A job that waited on answers reads Answered · fixing, then Answered · fixed, linking the
    `/omni:yolo-fix` job the answers started; that job reads `after answers · job <id>`. With the
    repository's switch off, it reads Answered with a Fix with answers button (PRD 2270).
  - A done job links its pull request. A yolo job that ended on its hand-off's last line reads its
    outcome in place of Done (PRD 2223): Waiting on answers or Held in `--ask-plasma`, Ready in
    `--ask-green`, with a PRD page link beside its pull request.
  - A bug fix that stopped for a decision and asked on its job reads **Need human**, filled in
    `--ask-plasma`, in place of Done (PRD 2255). Its action is a Need human button that opens the
    `runner-need-human` drawer and sets `?answer=<job id>` on the URL; once answered or dismissed,
    the job reads Done.
  - A job shows its tokens beside its status (`1.4M tokens`) once its runner reported them (PRD 2102).
  - A job names its agent and model beside its status (`codex · gpt-5-codex`), and, when it turned
    over to another account, one line per part under it: `claude-1 · Opus 5.5 · 13:41–14:02 · usage
    limit`, then `codex-1 · gpt-5-codex · since 14:02` (PRD 2537).
  - A job that held claims when it ended lists, under its status in `--ask-red`, the sub-PRs its
    runner released: `Released #<n>, #<n>`, each linked; a release that failed reads `Could not
    release this job's claims: <why>` (PRD 2175).
  - A queued job whose every possible runner is paused says why under its status: `Waiting:
    <runner> paused (<reason>)`, or `Waiting: every runner paused (<reason>)` (PRD 2102), or `Waiting:
    every runner out of tokens until <time>` (PRD 2537).
  - A queued job that no runner of the workspace can take reads **Cannot run** in `--ask-red`, in
    place of Queued, with why under it (PRD 2482): `No runner holds <owner/name>`, `<runner> does not
    hold <owner/name>`, `No runner of <fleet> holds <owner/name>`, `The runner it was sent to is gone`,
    `Fleet <fleet> is gone`, or `No runner can run it as <key>'s GitHub App`. An offline, busy or
    paused runner still counts. It keeps its Cancel, and reads Queued again once a runner can take it.
  - A job an API key sent shows `API key <name>` as its sender, with `made by @<login>` under it
    (PRD 2022), followed by ` · for <acting_for>` when the app said whom it acted for, as given and
    never matched to a member (PRD 2425). A job an answer or a relaunch queued from it reads the
    same sender.
  - A job the Omni app sent, which no person asked for, shows `Omni app` as its sender, with
    `retro of PRD <n>` under it, linked to the retro pull request (PRD 2338).

## States

- **No runner yet:** the page says how to start one, with `omni runner --name <name> --repos <dir>`
  to copy.
- **A job's status:** Queued, Cannot run (PRD 2482), Running with its time, Done (or its outcome: Waiting on answers, Held,
  Ready, Need human), Failed with its reason (`runner lost`,
  `timeout`, the exit code), Cancelled, with `by API key <name>` under it when a key cancelled it
  (PRD 2425). A bug fix's outcome a key reads (already fixed, not a bug…) still reads Done here.
- **Paused** (PRD 2102): the runner's state reads `Paused: <reason>` in `--ask-red`, in place of
  Online or Busy, while its last report names a pressure. A runner whose every account is out reads
  `Paused: no tokens left until <time>` the same way (PRD 2537).
- **A health line:** a figure it could not read is `—` with no bar; an offline runner's last
  figures are greyed under `as of <age>`; a runner that never reported shows `Update this runner
  to see its health.` with `omni update` to copy; no sample in the hour, no sparkline.
- **A viewer who is not an owner:** each fleet reads as text, with no picker.
- **Refresh:** the rows are read again every 5 seconds while the page is open.
- **A job stopped mid-way** (a `/omni:yolo` or `/omni:yolo-fix` that ended before its hand-off): `Stopped mid-way` in `--ask-red`, never Done, with `<k> / <n> slices merged` under it when known and the claims it released; its one action, Resume, sends the same line again as the person who presses it, and is the page's primary (PRD 2375).

## Words

Runners · Runner · State · Online · Busy ·
Offline · Fleet · Shared · Slots · Repositories · Kit · Jobs · Line · Repository · Sent by · Where ·
Any runner · Status · Queued · Cannot run · No runner holds · does not hold · is gone · GitHub App · Running · Done · Failed · Runner lost · Timeout · Cancelled ·
Cancel · Send again · Terminal · No job yet · API key · made by · for · by API key · Omni app · retro of PRD · Paused · CPU · load · Memory ·
Disk · free · Tokens · today · as of · Waiting · every runner paused · Update this runner to see its
health · no tokens left · until · out of tokens · usage limit · since · Released · Could not release this job's claims · Need human · Stopped mid-way · Resume · slices merged.

## Refusals

- No free-text prompt: a job is only a line the app copies, from the list of skills a runner may run.
- No job runs again by itself: Send again and Send answers are a person's press, or the call of an
  API key of the workspace on a job a key sent, shown as that key's (PRD 2425).

## Open questions

- Is Send again the page's one primary action, or does the page have none while nothing failed?
- Should the health line fold away on a phone, leaving only the state and a Paused reason?
- Does a member see the jobs of fleets they are not in, or only their own fleet's and the shared
  ones?

## Source

/omni:brainstorm, PRD 1830: .omni-loop/delivery/shipped/1830-runners/before-after.html
/omni:brainstorm, PRD 1904: .omni-loop/delivery/shipped/1904-runner-live-logs/before-after.html
/omni:brainstorm, PRD 2022: .omni-loop/delivery/shipped/2022-api-keys-v1/before-after.html
/omni:brainstorm, PRD 2102: .omni-loop/delivery/shipped/2102-runner-health/before-after.html
/omni:brainstorm, PRD 2175: .omni-loop/delivery/shipped/2175-runner-dead-claims/before-after.html
/omni:brainstorm, PRD 2223: .omni-loop/delivery/shipped/2223-outbox-waiting/before-after.html
/omni:brainstorm, PRD 2251: .omni-loop/delivery/shipped/2251-runner-follow/before-after.html
/omni:brainstorm, PRD 2255: .omni-loop/delivery/shipped/2255-need-human/before-after.html
/omni:brainstorm, PRD 2270: .omni-loop/delivery/shipped/2270-fix-when-answered/before-after.html
/omni:brainstorm, PRD 2338: .omni-loop/delivery/shipped/2338-retro-apply/before-after.html
/omni:brainstorm, PRD 2375: .omni-loop/delivery/shipped/2375-job-stopped-mid-way/before-after.html
/omni:brainstorm, PRD 2425: .omni-loop/delivery/shipped/2425-api-key-job-control/before-after.html
/omni:brainstorm, PRD 2537: .omni-loop/delivery/inbox/2537-runner-turnover/before-after.html
/omni:brainstorm, PRD 2482: .omni-loop/delivery/shipped/2482-runner-cannot-run/before-after.html
