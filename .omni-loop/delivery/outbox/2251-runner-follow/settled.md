# Settled outbox items — PRD 2251

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-runners-read-by-repository -->

## s1-01-runners-read-by-repository — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-runners-read-by-repository
prd: 2251
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The spec asks for one address that lists a workspace's runners, but a person can belong to several workspaces, so the address alone cannot tell which one to list.

## The decision, in plain words

The terminal names the repository it is in, and the list shows the runners of the workspace that repository belongs to, to its members only.

## The intro, for fun

One person, three workspaces, and a terminal asking which runners are free.

## The punchline, for fun

The repository you stand in answers it before anyone has to.

## The options, in plain words

A. A. The terminal names its repository, and reads that workspace's runners (as built).
B. B. The address takes no query and lists the runners of every workspace the person belongs to.
C. C. The terminal names a workspace instead of a repository.

## What I had to decide

Whether the runners list is read by the repository the terminal is in (as built: GET /api/runners?repo=owner/name), or by something else, such as every workspace the person belongs to.

## What I did meanwhile

GET /api/runners requires repo=owner/name and answers the runners of that repository's workspace, all of them, each with its repositories, so the HUD and the follow can keep the ones online for this repository. A query without it is refused with 400; a person outside that workspace is refused with 403, as sending a job there is.

## What it costs to change later

A constant: the route reads one query parameter, and the kit's client (s3) sends it. Reading every workspace instead is a new service method, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the route without a query and does not say which workspace a member of several reads; every other route the terminal reads (the loop, the dossiers, approvals) takes repo=owner/name, so this follows them.
- (author) A person outside the workspace gets 403 with the reason, as POST /api/runners/jobs answers today; the job lines route keeps its 404.

```

<!-- /omni-outbox-settled: s1-01-runners-read-by-repository -->

<!-- omni-outbox-settled: s1-02-prd-jobs-among-listed -->

## s1-02-prd-jobs-among-listed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-prd-jobs-among-listed
prd: 2251
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When the terminal asks for a PRD's jobs, how far back should it look: every job ever sent for it, or only the ones the Runners page still lists?

## The decision, in plain words

It looks among the jobs the Runners page lists, the waiting and running ones plus the last fifty that ended, and keeps the ones whose line names the PRD.

## The intro, for fun

A PRD built three weeks and two hundred jobs ago asks to be followed again.

## The punchline, for fun

The terminal only remembers what the page still shows.

## The options, in plain words

A. A. Look among the jobs the Runners page lists (as built).
B. B. Look across every job of the repository, with a new storage read.

## What I had to decide

Whether a PRD's jobs are looked up among the jobs the Runners page lists (as built), or across every job the workspace ever ran.

## What I did meanwhile

GET /api/runners/jobs reads the workspace's queued and running jobs and its last 50 ended ones, keeps those of the repository whose line's first argument is the PRD's number, and answers them newest first. A PRD whose last job ended before the workspace's last 50 answers no job, so the follow waits for one.

## What it costs to change later

A constant: a new read in the runners' storage that filters by repository and line, and a change in the store's fake. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory holds the service, not the storage fake its tests run on, so a new storage read was left out; the jobs a follow needs, the one queued or running and the one just ended, are always among the listed ones.

```

<!-- /omni-outbox-settled: s1-02-prd-jobs-among-listed -->
