---
screen: runners
status: draft
kind: page
mock: runners.html
implements: [apps/galaxy/app/app/runners/page.tsx, apps/galaxy/src/runners/page/RunnersPage.tsx, apps/galaxy/src/runners/page/runners.css, apps/galaxy/src/runners/page/Repositories.tsx, apps/galaxy/src/runners/page/SeatActions.tsx]
reads: [apps/galaxy/src/runners/page/Terminal.tsx, apps/galaxy/src/runners/runners.contract.ts, apps/galaxy/src/runners/runners.service.ts, apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/sidebar.ts, apps/galaxy/src/supervisor/api/supervisor.contract.ts, apps/galaxy/src/supervisor/api/supervisor.service.ts]
routes: [/app/runners]
supersedes: null
---

## Purpose

The workspace's runners and the jobs sent to them: which machines are online, what each one is
running, and where each job ended, with its pull request and a Terminal that shows its live log
(the `runner-terminal` screen, PRD 1904), and the drawer where a person answers a bug fix that
stopped for a decision (the `runner-need-human` screen, PRD 2255). A workspace owner gives
a runner to a fleet here, and places the Supervisor's seat on a runner, or moves it (PRD omni-loop-34). It sits inside the app shell, a shared screen of its own, `app-shell`.

## Regions

- **The title,** Runners, once, with `<n> runners · <k> online · <u> of <s> slots in use` under it
  (PRD 3232); the slot kept for the Supervisor is not counted in `<s>`, and while an online runner holds
  the seat the line ends `· 1 kept for the Supervisor` (PRD omni-loop-34).
- **Runners:** one card per runner (PRD 3232), in this order:
  - its name, its fleet (a picker for a workspace owner and plain text for everyone else) and a
    Terminal button, opening its running job, else its last job; disabled, titled "No job yet", when
    it has run none; `Keeps <size> until <day time>` under the name (PRD 2809);
  - whether it can take work: its state (Online, Busy, Offline with when it was last seen, `Paused:
    <reason>`), one pip per slot, filled when used, and `<used> of <slots> slot(s)`; each busy pip is
    titled with the fleet of the job using it, and the line under them names them: `Used by <fleet>,
    Any runner` (the label of the job's `toFleet`, `Any runner`, or the runner's name when the job was
    sent to it) (PRD 3232);
  - on the runner that holds the Supervisor's seat (PRD omni-loop-34, before/after 3.A): its last slot
    is kept for the seat, drawn as a cyan pip after the job pips, titled `Kept for the Supervisor`; the
    count reads the job slots only (`2 of 3 slots`), with a cyan `+1 Supervisor` pill beside it;
  - under it, that runner's seat strip, bordered in cyan: the owl, `Supervisor · watching` (or
    `paused`, `offline`, `thinking paused` past its daily tokens), then `last look <span>` (`no look
    yet`), `<n> tokens` of the day and the account it thinks on (the runner's first Claude account that
    is not out; none named when none is), with **Move** for a workspace owner: it opens, in place, one
    `To <runner>` button per other runner, and one press moves the seat there; with no other runner it is
    disabled, titled `No other runner to move it to`;
  - while the workspace has no seat, `Place the Supervisor` on every card, for a workspace owner only;
  - its account chips (PRD 2537), in the order its accounts file lists them: the account's id, in the
    ink colour when ready, in `--ask-plasma` when active, in `--ask-red` when out or unusable, each
    titled with its agent and its state (`out until 18:00`, `not signed in`); a runner with no
    accounts file shows none; then Tokens (`<n> in 5 h · <n> today`, the four-count split in its
    title) with the last hour's sparkline;
  - the health gauges (PRD 2102): CPU (percent and `load <n> / <cores>`), Memory (`<used> of <total>
    GB`) and Disk (`<free> GB free of <total>`), each with a bar, a tick at the runner's own limit when
    it has one, and the last hour's sparkline; a gauge past its limit reads in `--ask-red`, with an
    icon;
  - `<n> repositories`, then `· <k> with jobs` when some have a job queued or running: a button that
    opens the repositories drawer (`?repos=<runner>`, PRD 3232); then the kit version, in `--ask-red`
    with `blocks <n> job(s)` only when a queued job reads `Update the runner's kit` and this runner
    could take it.
- **Repositories drawer** (PRD 3232): the runner's name, `<n> repositories this runner holds`, a search
  field, then the list, repositories with a job queued or running first, then A–Z: the owner dimmed
  and the name, its running and queued counts (a Cannot run job marked so), its last ended job among
  the last 50 (status, pull request, age, or `No job in the last 50`) and `Also on <runner>, …` or
  `Only on this runner`; at its foot, `Last job: among the last 50 only.` Esc, the close button and a
  click outside close it.
- **Needs you** (PRD 3232): a band above the jobs filter, on every tab, listing the jobs that wait on a
  person (Need human, Waiting on answers, Held, Answered, Stopped mid-way, Lost 3 times), each with its
  status, line, one action and Terminal; with none, not drawn. The page's one primary action is taken
  among the jobs on screen: this band first, then the open tab.
- **The jobs filter** (PRD 3232): tabs with counts, Running · Cannot run · Failed · Done · All, kept as
  `?jobs=`, Running by default; the Cannot run and Failed counts in `--ask-red` when above zero.
  Running holds Queued, Waiting, Starting, Running, Lost · resuming and Answered · fixing; Failed holds
  Failed, Timeout and Runner lost; Done holds Done, Ready, Answered · fixed, Cancelled and Expired; All holds
  every job. An empty Running tab reads **Nothing running.**, the last job that ended, and a link to
  each tab with jobs; another empty tab reads **No job here.** with `Nothing here in the last 50.`
- **Jobs:** the open tab's jobs, queued and running first, then the last 50 that ended. Each row shows the line, the
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
    91 %`, then `codex-1 · gpt-5-codex · since 14:02` (PRD 2537).
  - A job that held claims when it ended lists, under its status in `--ask-red`, the sub-PRs its
    runner released: `Released #<n>, #<n>`, each linked; a release that failed reads `Could not
    release this job's claims: <why>` (PRD 2175).
  - A queued job whose every possible runner is paused says why under its status: `Waiting:
    <runner> paused (<reason>)`, or `Waiting: every runner paused (<reason>)` (PRD 2102), or `Waiting:
    every runner out of tokens until <time>` (PRD 2537).
  - A queued job that no runner of the workspace can take reads **Cannot run** in `--ask-red`, in
    place of Queued, with why under it (PRD 2482): `No runner holds <owner/name>`, `<runner> does not
    hold <owner/name>`, `No runner of <fleet> holds <owner/name>`, `The runner it was sent to is gone`,
    `Fleet <fleet> is gone`, or `Update the runner's kit` (PRD 2573, which
    replaced `No runner can run it as <key>'s GitHub App`). An offline, busy or
    paused runner still counts. It keeps its Cancel, and reads Queued again once a runner can take it.
    Beside Cancel, its one fix (PRD 3232): copy `omni runner --name <name> --repos <dir>` for a
    repository no runner holds; for a workspace owner, Show fleet, focusing the fleet picker of a runner
    that holds it; Send to any runner when its runner or fleet is gone; copy `omni update` for an old
    kit.
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
- **A viewer who is not an owner:** each fleet reads as text, with no picker; the seat strip shows,
  with no Move, and no card offers `Place the Supervisor` (PRD omni-loop-34).
- **The seat cannot be read:** no strip, no kept slot and no Place; the rest of the page as before.
- **The seat offline:** its strip reads `Supervisor · offline`, bordered in `--ask-red`.
- **Refresh:** the rows are read again every 5 seconds while the page is open.
- **A job stopped mid-way** (a `/omni:yolo` or `/omni:yolo-fix` that ended before its hand-off): `Stopped mid-way` in `--ask-red`, never Done, with `<k> / <n> slices merged` under it when known and the claims it released; its one action, Resume, sends the same line again as the person who presses it, and is the page's primary (PRD 2375).
- **A lost job that resumes** (PRD 2809): `Lost · resuming` in `--ask-red`, in place of `Failed · runner lost`, with `<runner> went silent at <time>` under it, linking its resume. The resume reads `after a loss · job <id>`, then `attempt <k> of 3`, and once started one line of what came back: `Resumed from the <time> save · <n> branches`, `Started over: nothing was unsaved`, or `<n> files stayed on <runner>`.
- **Lost 3 times** (PRD 2809): in `--ask-red`, the losses' times under it; its one action is Resume, as for a job stopped mid-way.
- **A job that expired** (PRD omni-loop-35, before/after 1.A): a job that ended Held, Waiting on answers or Need
  human and that nobody continued for 48 h reads **Expired** in the muted tone of Cancelled, with
  `nobody continued it in 48 h` under it, muted; it leaves Needs you and is listed under Done, keeps its
  pull request link, and its action is Send again, which an API key may also press on a job a key sent.
  A queued job that no runner took in 48 h reads `Failed` with `Expired: no runner took it in 48 h` under
  it, `Any runner` (or where it was sent) as its Where, and Send again; no runner ever held it.
- **A runner keeping a local save** (PRD 2809): `Keeps <size> until <day time>` under its name.

## Words

Runners · Runner · State · Expired · nobody continued it in 48 h · no runner took it in 48 h · Online · Busy ·
Offline · Fleet · Shared · Slots · Repositories · Kit · Jobs · Line · Repository · Sent by · Where ·
Any runner · Status · Queued · Needs you · Nothing running · No job here · Nothing here in the last 50 · All · repositories · with jobs · this runner holds · Search repositories · Also on · Only on this runner · No job in the last 50 · Last job · among the last 50 only · Used by · slot · Show fleet · Send to any runner · blocks · Copy · Cannot run · No runner holds · does not hold · is gone · Omni App · Update the runner's kit · Running · Done · Failed · Runner lost · Timeout · Cancelled ·
Cancel · Send again · Terminal · No job yet · API key · made by · for · by API key · Omni app · retro of PRD · Paused · CPU · load · Memory ·
Disk · free · Tokens · today · as of · Waiting · every runner paused · Update this runner to see its
health · no tokens left · until · out of tokens · usage limit · since · usage warning · context · Released · Could not release this job's claims · Need human · Stopped mid-way · Resume · slices merged · Lost · resuming · went silent at · attempt · of 3 · after a loss · job · Resumed from the · save · branches · Started over: nothing was unsaved · files stayed on · Lost 3 times · Lost at · Keeps · until · Place the Supervisor · Supervisor · watching · paused · offline · thinking paused · last look · no look yet · tokens · +1 Supervisor · Kept for the Supervisor · kept for the Supervisor · Move · To · No other runner to move it to.

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

/omni:brainstorm, PRD omni-loop-35 (a product PRD): its before/after page on the Omni page, screen 1.A

/omni:brainstorm, PRD omni-loop-34 (a product PRD): its before/after page on the Omni page, screen 3.A

/omni:brainstorm, PRD 3232: .omni-loop/delivery/shipped/3232-runners-redesign/before-after.html

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
/omni:brainstorm, PRD 2537: .omni-loop/delivery/shipped/2537-runner-turnover/before-after.html
/omni:brainstorm, PRD 2482: .omni-loop/delivery/shipped/2482-runner-cannot-run/before-after.html
/omni:brainstorm, PRD 2573: .omni-loop/delivery/shipped/2573-runner-jobs-as-omni-app/before-after.html
/omni:brainstorm, PRD 2809: .omni-loop/delivery/shipped/2809-unlosable-jobs/before-after.html
