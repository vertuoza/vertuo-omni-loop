# Settled outbox items — PRD 1322

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-push-and-email-packages-wait-for-their-sender -->

## s1-01-push-and-email-packages-wait-for-their-sender — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-push-and-email-packages-wait-for-their-sender
prd: 1322
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The plan asked this first step to add the two libraries that send phone alerts and emails, but nothing in this step sends anything yet, and the repository refuses a library no code uses. Should they be added now or with the step that sends?

## The decision, in plain words

They are not added here: the step that sends the alerts and emails adds them, together with the code that uses them.

## The intro, for fun

Two libraries packed for a trip they cannot take yet.

## The punchline, for fun

They ride along with the sender instead.

## The options, in plain words

A. A. Add the libraries in the step that first sends an alert, with the code that uses them (built).
B. B. Add them here anyway and exempt them from the unused-dependency check until the sending step lands.

## What I had to decide

Whether the push and email libraries come in with this step or with the step that first sends an alert.

## What I did meanwhile

The settings for both channels are read and documented; the libraries arrive with the sending step, which also owns the package list and lock file changes it needs.

## What it costs to change later

Low: adding two dependencies later is a one-line change in the package list and a lock file refresh.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the package list and lock file only to this step; the sending step (s2) needs them added to its territory when it runs (author).

```

<!-- /omni-outbox-settled: s1-01-push-and-email-packages-wait-for-their-sender -->

<!-- omni-outbox-settled: s1-02-alert-settings-listed-in-the-galaxy-readme -->

## s1-02-alert-settings-listed-in-the-galaxy-readme — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-alert-settings-listed-in-the-galaxy-readme
prd: 1322
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The four new settings for phone alerts and email must be listed in the page's setup guide, which the plan gives to a later step. Should this step add them to that list now?

## The decision, in plain words

This step adds the four settings to the setup guide's list of settings, two lines and nothing else, so the check that the guide and the code agree stays green.

## The intro, for fun

A new key on the ring, and the label maker is in the next room.

## The punchline, for fun

Two lines of label, borrowed early.

## The options, in plain words

A. A. List the four settings in the README now, the two lines only (built).
B. B. Leave the README to its later step and let the settings check fail until then.

## What I had to decide

Whether the galaxy README's list of settings gains the four alert settings in this step, outside its listed ground, or waits for the step that owns the README.

## What I did meanwhile

The README's marked settings list names VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, RESEND_API_KEY and RESEND_FROM; the later step that describes the handshake in the README keeps those two lines.

## What it costs to change later

Low: two lines in a list; the later step can reword them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s8, which owns apps/galaxy/README.md, wants these lines worded otherwise is not known (author).

```

<!-- /omni-outbox-settled: s1-02-alert-settings-listed-in-the-galaxy-readme -->

<!-- omni-outbox-settled: s4-01-approval-stream-contract -->

## s4-01-approval-stream-contract — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-approval-stream-contract
prd: 1322
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec names the two new server calls the waiting command makes, but not exactly what they answer. What do the command and the server agree each answer holds?

## The decision, in plain words

The command expects the people asked by name, whether only the author was left, the author and the product, then four kinds of news with a rising number each: asked, approved, voided and asked again. The server work is built to match.

## The intro, for fun

Two teams build both ends of one phone line at the same time.

## The punchline, for fun

So somebody wrote down what hello sounds like before anyone dialled.

## The options, in plain words

A. A. Keep the shapes as recorded here, with the approved event carrying who, when and how many files.
B. B. Have the approved event carry only its number, and let the kit read the approval again and compare the files before it says approved.
C. C. Have the request answer also the approval already in force, so the kit makes one call instead of two before it waits.

## What I had to decide

Contract the kit relies on (kit/lib/approval/stream.ts, kit/lib/approval/wait.ts), for s2 and s3 to match. POST /api/dossiers/approval/request, body {repo: 'owner/name', prd: number}, answers 200 {asked: [{login: string, name?: string|null}], nobodyElse: boolean, author: string, product: string|null}; nobodyElse true means only the author is asked (asked may then be empty or hold the author). 401 after one token refresh means signed out (exit 1); any other 4xx is 'refused (<status>)', exit 1; 5xx or unreachable is retried as a failed try. GET /api/dossiers/approval/stream?repo=&prd= with Accept: text/event-stream and Last-Event-ID when resuming answers 200 text/event-stream; events: 'asked' and 're-asked' with data equal to the request's reply shape; 'approved' with data {approver: login, approvedAt: ISO time, pinned: number of files}; 'voided' with data {pusher: login, kind: string, from: full sha256, to: full sha256} (the kit prints the first 7 characters); 'ping' and 'reconnect' with no data and no id. Every other event carries an increasing id; the kit drops an id it has seen. 'reconnect' makes the kit reconnect at once; a stream that closes before any message counts as a failed try. An approval already in force is read through the existing GET /api/dossiers/approval before any request. Small choices taken with it: a repository with no product says 'this repository has no other approver'; the approved time prints as the ISO string the server sends, as omni approval does.

## What I did meanwhile

s2 and s3 build their replies to these shapes; the kit's tests stub exactly these shapes.

## What it costs to change later

A renamed field is a one-line change in the kit's schema and in the server's service; nothing is stored in this shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether an approved event should be checked against the files in the checkout; the kit trusts the event and leaves that check to omni approval at the gates

```

<!-- /omni-outbox-settled: s4-01-approval-stream-contract -->

<!-- omni-outbox-settled: s4-02-waiting-file -->

## s4-02-waiting-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-waiting-file
prd: 1322
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec says the waiting command keeps a small file the on-screen band reads, but not where or what it holds. Where does it live, and what is in it?

## The decision, in plain words

One file per PRD in the checkout's private folder, holding the current state, its line, the waiting line and when it was written. The command leaves its last state there when it ends, so the band can show it for ten seconds.

## The intro, for fun

The band wants to know what the terminal is waiting for.

## The punchline, for fun

Sticky notes on the fridge, one per PRD, never thrown away mid-sentence.

## The options, in plain words

A. A. One file per PRD under the private folder, left with its last state.
B. B. One single file for the checkout, the last wait to write winning.
C. C. One file per PRD, deleted when the wait ends, the band keeping the last line itself.

## What I had to decide

File: .omni-loop/local/approval-wait/<n>.json (the folder carries the existing .gitignore of .omni-loop/local). Content: {prd: number, state: 'waiting'|'approved'|'voided'|'held'|'signed-out'|'timeout'|'refused', line: the line just printed, waiting: the current waiting line or null before anyone is asked, at: ISO time it was written}. Written on every line printed after the request; left in place with the last state when the command exits. Not written when the command stops before asking (no ask.url, no sign-in, PRD not found). s5 reads it: show 'waiting' while state is waiting or held, and highlight 'approved' or 'voided' for 10 seconds from 'at', then fall back to 'waiting' after a void.

## What I did meanwhile

s5 builds the band against this file and shape.

## What it costs to change later

Moving or reshaping the file is a constant in the kit's wait module and in the band; it is never committed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether two terminals may wait on two PRDs at once; one file per PRD lets them

```

<!-- /omni-outbox-settled: s4-02-waiting-file -->

<!-- omni-outbox-settled: s2-01-bell-and-check-outside-the-plan-ground -->

## s2-01-bell-and-check-outside-the-plan-ground — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-bell-and-check-outside-the-plan-ground
prd: 1322
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

Showing an approval request in the bell, and proving the new database rules in the automatic checks, both need files the plan did not give to this step. Should this step change them?

## The decision, in plain words

Yes: this step adds an Approvals group to the bell with its own small read, and adds a database check that the automatic checks run, as every new database rule here must have.

## The intro, for fun

The bell had room for one more line, but the bell lives next door.

## The punchline, for fun

So this step knocked, borrowed a nail and hung it.

## The options, in plain words

A. A. Change the bell, add its route, the database check and the publication here (built).
B. B. Leave the bell's drawing and the check to a later slice, and show nothing in the bell until then.
C. C. Read the requests straight from the database in the browser, without a route, as the older bell parts still do.

## What I had to decide

Whether the bell's drawing, its new read route and a new database check are changed by this step, outside the ground the plan gave it.

## What I did meanwhile

The bell (apps/galaxy/src/nav/bell.ts, Bell.tsx, and the count in sidebar.test.ts) gains an Approvals group after Questions, counted in the badge, read from GET /api/waiting/approvals (apps/galaxy/app/api/waiting/approvals/route.ts, served by approvals.controller.ts) every 15 s. supabase/checks/approval_requests.sql proves who is asked, the bell's read and the recipients function, and .github/workflows/supabase.yml runs it, as the conventions require. The migration also adds approvals, approval_voids and approval_requests to Supabase Realtime's publication, which the stream (s3) follows and which no later slice has a migration to do.

## What it costs to change later

Low: the bell group is one function and one prop; the route is two lines; the check is a file and a workflow step. Moving any of them is a rename.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists apps/galaxy/src/waiting/ for the bell, but the bell is drawn in apps/galaxy/src/nav/, and PRD 1318 asks new reads to go through a route rather than the browser's database client.
- (author) Whether s3 wants the requests table in the Realtime publication as well as approvals and voids is not known; it is added so re-asked events can be streamed.

```

<!-- /omni-outbox-settled: s2-01-bell-and-check-outside-the-plan-ground -->

<!-- omni-outbox-settled: s2-02-what-the-phone-alert-and-email-say -->

## s2-02-what-the-phone-alert-and-email-say — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-what-the-phone-alert-and-email-say
prd: 1322
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec says the phone alert and the email show the PRD's one-line before and after, but nothing writes such a line down, and the phone's page must read what the alert carries. What do they hold?

## The decision, in plain words

The before and after line is the first sentence of the spec's Problem, then the first sentence of its Solution. The phone alert carries a title, the spec's title with that line, and the PRD page's link; the email adds the repository, the file hashes and the whole Problem and Solution.

## The intro, for fun

A one-line summary was promised, and nobody had written the line.

## The punchline, for fun

So the spec's own first sentences were asked to speak up.

## The options, in plain words

A. A. First sentences of Problem and Solution; push payload {title, body, url} as s9's service worker reads it (built).
B. B. Add a one-line before → after field to the spec's front matter, and show it only when present.
C. C. Leave the line out and show only the title, the repository and the hashes.

## What I had to decide

Where the notification's one-line before → after comes from, and the payload the service worker (s9) reads from a push.

## What I did meanwhile

approvals.service.ts builds the message: title `PRD <n> waits for your approval`; lines: the spec's title, `<first sentence of Problem> → <first sentence of Solution>` (each cut at 140 characters, a line dropped when the spec has neither section), and `<repo> · spec <7 chars> · plan <7 chars> · before-after <7 chars>` from the latest version of each kind. The push payload is exactly the JSON {title, body, url} that s9's service worker reads (item s9-01-push-payload-shape): body the spec's title and the before → after line, url the path /prd/<dossier id>. The email's subject is `PRD <n> waits for your approval: <title>`, its text and HTML hold the same lines, then the Problem and Solution sections, then the link.

## What it costs to change later

Low: the payload is built in one function and read by one service worker; nothing is stored in this shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names a one-line before → after but not where it is written; the before/after page has no such line either.
- (author) The payload follows s9's item s9-01-push-payload-shape, relayed by the wave while both slices ran.

```

<!-- /omni-outbox-settled: s2-02-what-the-phone-alert-and-email-say -->

<!-- omni-outbox-settled: s2-03-who-the-author-is-and-when-a-request-stops-waiting -->

## s2-03-who-the-author-is-and-when-a-request-stops-waiting — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-who-the-author-is-and-when-a-request-stops-waiting
prd: 1322
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

Who counts as a PRD's author when nobody is recorded as having opened it, when is a request asked again, and when does it leave the asked person's bell?

## The decision, in plain words

The author is whoever opened the PRD on the page, or the person asking when nobody is recorded, and any request after the first is an asking again. A request leaves the bell once someone approves the PRD after it was asked.

## The intro, for fun

Every PRD has a parent, except the ones that do not.

## The punchline, for fun

Then whoever rings the bell is the parent for the day.

## The options, in plain words

A. A. Opener else asker; any later request re-asked; leaves the bell at the next approval (built).
B. B. Refuse a request when the PRD has no recorded opener, and call a request re-asked only after a void.
C. C. Also drop a request from the bell after a fixed time, such as a week.

## What I had to decide

Three small rules the spec leaves open: the author's identity, what `re-asked` means, and when the bell stops listing a request.

## What I did meanwhile

approval_request() takes dossiers.opened_by as the author, falling back to the caller; any request for a dossier that already has one is `re-asked`; approval_requests_waiting() lists, per dossier, the latest request that names the caller, until an approval dated at or after it exists. Logins follow dossier_approve()'s rule (player login, GitHub identity, email), names are the player's display name.

## What it costs to change later

Low: each rule is one line of one function, changed by a later migration; no row changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says re-asked follows a void; voids land in s6, so for now any later request is re-asked.
- (author) A request nobody ever approves stays in the bell; the spec says nothing of expiry.

```

<!-- /omni-outbox-settled: s2-03-who-the-author-is-and-when-a-request-stops-waiting -->

<!-- omni-outbox-settled: s5-01-which-wait-the-band-shows -->

## s5-01-which-wait-the-band-shows — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-which-wait-the-band-shows
prd: 1322
slice: s5
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec says the band above the prompt shows the waiting line and a ten-second highlight, but not which wait it shows when several are kept, nor how quickly it notices the approval.

## The decision, in plain words

The band shows the wait of the PRD the session is on first, else the most recent one still waiting. While a wait runs it checks every five seconds, so the approval appears within seconds and stays highlighted for its ten seconds.

## The intro, for fun

The band only looks up every thirty seconds, and the highlight lasts ten.

## The punchline, for fun

So while someone waits, it glances up every five.

## The options, in plain words

A. A. The session's PRD first, else the latest live wait; check every 5 seconds while waiting (built).
B. B. Only the session's PRD's wait, never another PRD's.
C. C. Keep the 30-second check and start the 10 seconds when the band first sees the approval rather than when it was written.

## What I had to decide

omni now adds an optional wait key { prd, line, toast, until } to its answer, read from .omni-loop/local/approval-wait/<n>.json (the folder name repeated as a constant in kit/lib/now/wait.ts): the work's PRD's file first, else the latest file by its at time that shows something. waiting or held shows the waiting line (the line itself when no one was asked yet); approved or voided shows that line as a toast until at + 10 s, then the waiting line again after a void and nothing after an approval; signed-out, timeout and refused show nothing. The key is absent when nothing shows, so answers without a wait are unchanged. The band adds a wait row after the work and before its links (a toast row drawn inverse and bold), asks omni now every 5 s while a wait shows and once more when the toast ends.

## What I did meanwhile

Built as decided, with tests on the reading (kit/lib/now/wait.test.ts) and on the band (kit/plugin-hud/tests/hud.test.tsx). The plain omni now output prints the wait's line last.

## What it costs to change later

Low: the poll interval, the order of preference and the row's place are constants in kit/lib/now/wait.ts and kit/plugin-hud/hooks/band.ts; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A wait killed with Ctrl-C leaves its file in the waiting state, and the band keeps showing the waiting line until a later wait rewrites it; the wait command, outside this slice, could clear it on exit.
- (author) Polling omni now every 5 seconds runs a short node process that often for as long as a wait lasts (60 minutes by default).

```

<!-- /omni-outbox-settled: s5-01-which-wait-the-band-shows -->

<!-- omni-outbox-settled: s8-01-docs-guard-knows-wait -->

## s8-01-docs-guard-knows-wait — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s8
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-docs-guard-knows-wait
prd: 1322
slice: s8
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The documentation check refused the guide because the new waiting command lives in a file named differently from the command. Should the check learn that, or should the command's file be renamed?

## The decision, in plain words

The documentation check now also accepts a command the command list registers under that name, so the guide can name the waiting command as it is typed.

## The intro, for fun

The guide named a command, and the checker swore it had never met it.

## The punchline, for fun

They have now been introduced.

## The options, in plain words

A. The guard also accepts a command the commands' index imports by that name (built).
B. Rename the waiting command's file after the command, and leave the documentation check as it was.

## What I had to decide

Whether the docs guard reads a command from the commands' index when its file has another name, or the wait command's file is renamed to match.

## What I did meanwhile

The guard accepts a command its index imports by that name; every other check is as before.

## What it costs to change later

Small either way: renaming the file later means one move and dropping the extra lookup.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None known: the guard's test covers both a command's own file and an import in the commands' index.

```

<!-- /omni-outbox-settled: s8-01-docs-guard-knows-wait -->

<!-- omni-outbox-settled: s9-01-push-payload-shape -->

## s9-01-push-payload-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s9
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-push-payload-shape
prd: 1322
slice: s9
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The phone receives a small message when someone is asked to approve. What should that message hold, so the phone can show it and open the right page when tapped?

## The decision, in plain words

The message holds a title, a line of text and the page to open, and a tap only ever opens a page on the Omni site. A message the phone cannot read still shows a short generic alert.

## The intro, for fun

A phone buzzes, and somebody has to agree on what the buzz says.

## The punchline, for fun

Title, a line, a link: the haiku of approval alerts.

## The options, in plain words

A. Send a title, one line and the page to open, and keep taps on the Omni site (what was built).
B. Send only the PRD number and let the phone build the text and the link itself.
C. Send the whole text with the problem and solution, as the email does.

## What I had to decide

Whether the phone's message is a title, one line and a page to open, which the sending side (slice s2) must follow.

## What I did meanwhile

The service worker reads JSON {title, body, url}; s2's Web Push sender must send that shape. A url off the site falls back to /app.

## What it costs to change later

A constant: renaming a field is one edit in the service worker (src/push/worker.ts) and one in s2's sender.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names what the notification reads but not the payload's shape between the sender and the service worker (author).

```

<!-- /omni-outbox-settled: s9-01-push-payload-shape -->

<!-- omni-outbox-settled: s9-02-phone-alerts-off-is-per-person -->

## s9-02-phone-alerts-off-is-per-person — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s9
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-phone-alerts-off-is-per-person
prd: 1322
slice: s9
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

Someone uses phone alerts on two devices and turns them off on one. Should the other device keep getting alerts?

## The decision, in plain words

Turning phone alerts off on one device removes that device and turns phone alerts off for the person, so none of their devices is alerted until they turn it on again.

## The intro, for fun

Two phones, one switch, and a polite disagreement about who is in charge.

## The punchline, for fun

Off means off, everywhere, until someone says otherwise.

## The options, in plain words

A. Off on one device turns phone alerts off for the person and removes that device (what was built).
B. Off on one device removes only that device; the person stays on while any other device is subscribed.

## What I had to decide

Whether turning phone alerts off is for this device only or for the person.

## What I did meanwhile

The switch is stored once per person, as the spec's tables hold it; off also removes this device's subscription. Other devices keep their subscription but are not sent anything while the switch is off.

## What it costs to change later

A constant: a per-device switch would only change what the off press saves, and the sender's check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the switch is per person and the subscription per device, but not what off on one of several devices means (author).

```

<!-- /omni-outbox-settled: s9-02-phone-alerts-off-is-per-person -->

<!-- omni-outbox-settled: s9-03-service-worker-address -->

## s9-03-service-worker-address — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s9
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-03-service-worker-address
prd: 1322
slice: s9
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec puts the small background program that receives phone alerts at the site's root address. This repository allows no hand-written script files, so where should that program be served from?

## The decision, in plain words

The program is served by the app from an address under its alert routes, and it is allowed to cover the whole site, so phone alerts work exactly as the spec describes.

## The intro, for fun

The spec booked a room at the front door, but the house rules ban the furniture.

## The punchline, for fun

So the program moved in through the side door and still got the master key.

## The options, in plain words

A. Serve the worker from the alert routes, allowed the whole site (what was built).
B. Serve it at the site's root through a rewrite, which a later slice adds outside this one's ground.
C. Allow one hand-written script file in the public folder, as an exception to the guard.

## What I had to decide

Whether the service worker is served at /api/push/sw.js with scope '/' instead of a static /sw.js.

## What I did meanwhile

GET /api/push/sw.js serves the worker's source (src/push/worker.ts) with Service-Worker-Allowed: /, and the switch registers it with scope '/'. The typescript guard refuses a JavaScript source file such as public/sw.js, and the plan's territory has no route at /sw.js.

## What it costs to change later

A constant: moving it to /sw.js later is a route or a rewrite, and the path the switch registers; browsers keep the old worker until it is unregistered or replaced.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec and the plan name /sw.js, a static file the repository's typescript guard refuses (author).

```

<!-- /omni-outbox-settled: s9-03-service-worker-address -->

<!-- omni-outbox-settled: s3-01-what-the-stream-replays-and-its-event-ids -->

## s3-01-what-the-stream-replays-and-its-event-ids — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-what-the-stream-replays-and-its-event-ids
prd: 1322
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When the waiting terminal connects to the live approval feed, what does it hear first, and how does it pick up where it left off after the connection is cut?

## The decision, in plain words

Each event is numbered by its place in the PRD's history, so a resumed connection hears only what came after the last number it saw. A fresh connection hears the latest request, then only what followed it or the latest void, so an approval that a later change cancelled is never heard as if it still held.

## The intro, for fun

A feed that starts at the beginning tells the old ending first.

## The punchline, for fun

So it opens at the latest chapter and skips the spoilers.

## The options, in plain words

A. Ids are places in the time-ordered history; a fresh connection starts at the latest request, skipping an approval a later void ended (built).
B. Ids are each row's time in microseconds, and a fresh connection is sent the whole history.
C. A fresh connection is sent nothing old, only what lands after it opens.

## What I had to decide

The spec asks for increasing ids and a replay after Last-Event-ID, but not what the ids are, nor what a connection without an id is sent first. The kit exits 0 on the first approved event, so replaying a voided approval would end a wait wrongly.

## What I did meanwhile

stream.service.ts numbers events 1, 2, 3… by their place in the PRD's requests, approvals and voids sorted by time (microseconds kept; a request sorts before an approval before a void at the same instant). Last-Event-ID n resumes after the n-th; an id it does not know (not a number, or beyond the history) is read as none. With none, the stream sends the latest asked or re-asked event, then every event after the later of that request and the latest void. Realtime only triggers a fresh read of the history; every ping (15 s) reads it again too, so a missed notification costs at most one ping's delay. The stream lives until 15 s before the route's 300 s limit, then sends reconnect.

## What it costs to change later

Low: the numbering and the starting rule are two functions of one file; no stored shape depends on them, and the kit only compares ids it has seen.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what an id is; a place in the history assumes the rows stay append-only, which they are, though a deleted dossier or a row committed late with an earlier time could shift places.
- (author) The spec does not say what a connection without Last-Event-ID is sent first; the kit always checks for an approval in force before asking, so an older approval still in force is not replayed.

```

<!-- /omni-outbox-settled: s3-01-what-the-stream-replays-and-its-event-ids -->

<!-- omni-outbox-settled: s3-02-stream-reads-outside-its-own-files-and-names-people-by-player -->

## s3-02-stream-reads-outside-its-own-files-and-names-people-by-player — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-stream-reads-outside-its-own-files-and-names-people-by-player
prd: 1322
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The live approval feed needs to read the PRD's history and say who was asked by name. Where does that reading live, and where do the names come from?

## The decision, in plain words

The reading joins the shared approvals storage file, as the spec's layering asks, and the sign-in check is shared with the request route. Names come from each person's player profile in the workspace, the same place the page shows them, falling back to their account number when they have none.

## The intro, for fun

The feed knew everything that happened, but not everyone's name.

## The punchline, for fun

So it asked the team roster, the one everybody signed.

## The options, in plain words

A. Read in the approvals repository, shape in a stream service, names from player profiles with the account id as fallback (built).
B. Add a database function that names people exactly as the request does, in a migration outside this slice.
C. Read the names with the server's service key, which may call the login function.

## What I had to decide

The plan gives this slice files starting with stream, while the spec says the approvals repository is the only file that reaches the database; and the request rows store who was asked as accounts, not names, while the function that turns an account into a login is closed to signed-in members.

## What I did meanwhile

approvals.repository.ts gains historyRepository (the history read and the Realtime watch, as the caller), approvals.controller.ts exports refusalOf and a new callerOf (the sign-in check both routes use), and the event shaping lives in stream.service.ts rather than approvals.service.ts. The asked people, the author and their names come from the players table (GitHub login in lower case, display name), falling back to the account id when a member has no player row; the product's name from the products table; the approver and the pusher from the logins their rows recorded.

## What it costs to change later

Low: moving the read is a rename; reading names through a database function instead is one migration and one call, with no row changing shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A member with no player row is named by their account id in the stream, where the request's own reply names them by GitHub identity or email; the kit then prints the waiting line again with that id.
- (author) Whether the stream's shaping belongs in approvals.service.ts rather than its own stream file is not settled by the plan.

```

<!-- /omni-outbox-settled: s3-02-stream-reads-outside-its-own-files-and-names-people-by-player -->

<!-- omni-outbox-settled: s6-01-one-void-per-changed-file-one-alert-per-push -->

## s6-01-one-void-per-changed-file-one-alert-per-push — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-one-void-per-changed-file-one-alert-per-push
prd: 1322
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When one push changes two approved files, is the approval voided once or once per file, and how many alerts does the approver get?

## The decision, in plain words

Each changed file leaves its own void record, so the page can show exactly what changed, but the approver gets one alert and one email per push, listing every changed file. A later push does not void the same approval again.

## The intro, for fun

Two files changed in one push, and the approver's phone braced for twins.

## The punchline, for fun

It got one buzz with a list instead.

## The options, in plain words

A. A. A void per changed file, one alert per push listing them (built).
B. B. One void per approval, naming only the first changed file, and one alert.
C. C. A void and an alert per changed file.

## What I had to decide

How many approval_voids rows a push writes and how many notifications follow, and how the push route learns which voids its own push left.

## What I did meanwhile

dossier_push reads the approval in force once before adding versions, then appends one approval_voids row per added version of a pinned kind with another sha256. approval_voids gained version_id (the version that voided), so approval_voids_of_push(dossier) names the caller's voids whose version is still the latest of its kind; the route sends one message per push to the approver through approval_void_recipients() (service role). Push payload {title: `approval voided by <pusher>'s push`, body: `PRD <n> · <title>` and each `<kind> <old7>→<new7>`, url /prd/<dossier>}.

## What it costs to change later

Low: one loop in dossier_push and one function of the service; the column is additive and nothing read the table before.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names one void per approval (the kind, the old and new hash) but not a push that changes several pinned files at once.

```

<!-- /omni-outbox-settled: s6-01-one-void-per-changed-file-one-alert-per-push -->

<!-- omni-outbox-settled: s6-02-approval-route-carries-voids -->

## s6-02-approval-route-carries-voids — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-approval-route-carries-voids
prd: 1322
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The server's approval page, which no step of this plan owns, drops the news of a void before the checking command reads it. Should this step teach it to pass the void on?

## The decision, in plain words

Yes: the approval page now passes on, with each approval, the pushes that voided it, so the command reads a voided approval as drifted and names who pushed. Nothing else on that page changed.

## The intro, for fun

The news of a void was ready, and the messenger had no pocket for it.

## The punchline, for fun

So the messenger got one more pocket, and nothing else.

## The options, in plain words

A. A. Pass the voids on through the existing approval route (built).
B. B. Have dossier_approval() answer no approval at all once voided, so nothing outside the territory changes, and the kit reads it as pending instead of drifted.
C. C. Add a separate route for voids that the kit calls after the approval route.

## What I had to decide

Whether s6 may change apps/galaxy/src/approval/approval-api.ts, outside its territory, so GET /api/dossiers/approval passes dossier_approval()'s new `voids` on to the kit.

## What I did meanwhile

approval-api.ts's InForce schema reads an optional `voids: [{pusher, kind, from, to, voidedAt}]` and answerOf passes it on with voidedAt in ISO 8601; a test in approval-api.test.ts proves the kit's parseApprovalReply reads it. The kit's ApprovalSchema takes `voids` as optional, so a server without it reads as before.

## What it costs to change later

Low: one optional field in one schema and one line of its mapping; reverting it only makes the kit fall back to comparing files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives s6 kit/lib/approval/approval and the migration, but not the route between them; no other slice owns apps/galaxy/src/approval/.

```

<!-- /omni-outbox-settled: s6-02-approval-route-carries-voids -->

<!-- omni-outbox-settled: s7-01-approvers-unread-shows-approve -->

## s7-01-approvers-unread-shows-approve — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-approvers-unread-shows-approve
prd: 1322
slice: s7
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When the page cannot read who a product asks to approve, should a member still see the Approve button?

## The decision, in plain words

Yes: the page shows Approve to every member in that case, and the server still refuses anyone the product does not ask, with its own words.

## The intro, for fun

The guest list fell behind the sofa for a moment.

## The punchline, for fun

So the door stays open, and the bouncer at the server still checks every name.

## The options, in plain words

A. Show Approve to every member while the list cannot be read; the server refuses anyone not asked.
B. Hide Approve from everyone while the list cannot be read, and say why on the page.

## What I had to decide

Whether a failed read of the product's approvers shows Approve to every member, the server deciding, or hides it from everyone until the page reloads.

## What I did meanwhile

A member the product does not ask may see Approve during such a failure; pressing it shows the server's refusal and nothing is approved.

## What it costs to change later

One line in the page's approval view: switching to hiding the button is a constant change, no data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often that read fails in production is not known (author).

```

<!-- /omni-outbox-settled: s7-01-approvers-unread-shows-approve -->
