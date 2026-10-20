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
