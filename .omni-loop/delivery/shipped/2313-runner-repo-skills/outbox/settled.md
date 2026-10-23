# Settled outbox items — PRD 2313

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-s1-claim-and-test-fakes -->

## s1-01-s1-claim-and-test-fakes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1
- Stays here: A one-off split of work between two slices of this PRD; nothing lasting about how the product behaves or is built.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-s1-claim-and-test-fakes
prd: 2313
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The first part of this work had to touch two test helpers it was not assigned, and it also made the runner's job carry the allowed skills, which the plan gave to the second part. Is that split fine?

## The decision, in plain words

The job a runner picks up now carries the repository's allowed skills, read when it is picked up, and the shared test helpers know about them. The second part keeps the runner's own check and its tests.

## The intro, for fun

Two parts of the plan shared one doorway, and the first one through had to hold the door.

## The punchline, for fun

The second part walks straight in: the door is open, the hinges are tested.

## The options, in plain words

A. A. Keep it: the first part adds the allowed skills to the job, reads them when a runner picks the job up, and updates the two test files; the second part adds the runner's own check.
B. B. Move the reading of the allowed skills to the second part, and let the job's field stay optional until then.
C. C. Widen the plan's assigned files for the first part to cover the two test files, and keep the rest as built.

## What I had to decide

Keep it as built (A), or ask the second part to own the job's allowed skills and move that piece there (B).

## What I did meanwhile

The job a runner picks up lists the repository's allowed skills; a runner from before this change ignores them and refuses every repository skill, as today.

## What it costs to change later

Low either way: the change is a few lines in the service and two test files, undone by a revert of this part.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave the job's shape to the first part but the job's sending to the second part, and only the first part may change the shape: adding a required field to the shape forced the sending code to fill it here.
- (author) The test helper that stands in for the database and one test of the web routes sit outside this part's assigned files; both changes are one added field each.

```

<!-- /omni-outbox-settled: s1-01-s1-claim-and-test-fakes -->

<!-- omni-outbox-settled: s2-01-s2-job-tells-skill-by-line -->

## s2-01-s2-job-tells-skill-by-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s2
- Wave: 2
- Became: N-PRODUCT-19

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-s2-job-tells-skill-by-line
prd: 2313
slice: s2
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The runner loads a repository's own tool servers only for a job of a repository's own skill, but the program that starts the job is outside this part's files and says nothing of its kind. Is it fine that the job tells its kind from the line it was sent?

## The decision, in plain words

The job reads its own line: a line of one of the loop's own skills runs exactly as before, and any other line, which the runner only lets through as a skill the repository's owner allowed, loads the repository's tool servers when the repository declares them.

## The intro, for fun

The job had to guess its own kind, with only its orders in hand.

## The punchline, for fun

It reads the first word of its orders, and the gate before it already checked the rest.

## The options, in plain words

A. Keep it: the job tells the kind from its line, the runner having refused every other line before it starts.
B. Pass the kind from the runner to the job as a flag, in a follow-up that touches the command that starts the job.
C. Load the repository's tool servers for every job whose worktree declares them, a fixed skill's too.

## What I had to decide

Keep the job telling a repository skill's line from a fixed skill's by the line itself (A), or have the runner hand the job that answer when it starts it, which touches the command that starts the job (B).

## What I did meanwhile

A fixed skill's job runs with the same arguments as before. A repository skill's job runs with --mcp-config .mcp.json only when its worktree holds .mcp.json; the runner refuses any line that is neither a fixed skill nor one the job carries before the job starts.

## What it costs to change later

Low: one function in kit/lib/runner/job.ts; option B adds a flag to the job's command line in kit/bin/commands/runner.ts and passes it from kit/lib/runner/runner.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this part kit/lib/runner/job.ts but not kit/bin/commands/runner.ts, which starts the job and is the only place that could pass the job's kind.
- (author) The plan marks this part as touching a screen, but it changes none: the before/after page says the kit's part has no screen, and the design check found none, so no design review looked at a screen.

```

<!-- /omni-outbox-settled: s2-01-s2-job-tells-skill-by-line -->

<!-- omni-outbox-settled: s3-01-s3-repo-reader-lists-folders -->

## s3-01-s3-repo-reader-lists-folders — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s3
- Wave: 2
- Stays here: A local, easily reversed placement choice for one slice's helper methods; no lasting product guarantee or architecture decision to keep.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-s3-repo-reader-lists-folders
prd: 2313
slice: s3
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The runner skills list needs to read a folder of a repository on GitHub, and the shared GitHub reader only reads files. May the slice add a small folder read to that reader, outside its own territory?

## The decision, in plain words

The shared GitHub reader gained two small reads, the folders under a path and the repository's default branch name, so the block can list a repository's skills and say which branch an allowed skill left. Nothing existing changed.

## The intro, for fun

The skills were on the shelf, but the reader could only open files.

## The punchline, for fun

So the reader learned to open folders, one small door at a time.

## The options, in plain words

A. A. Add the two reads to the shared reader, as built.
B. B. Copy the GitHub call into the repositories folder, so no file outside the territory changes.

## What I had to decide

Whether the shared reader in apps/galaxy/src/business/draft/github.ts may carry these two reads, or the block should carry its own copy of the GitHub call. Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Built as a pair of added methods on the existing reader, which no other code calls.

## What it costs to change later

Undone by deleting the two methods and moving them into the repositories folder, a small change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists no file outside the repositories folder for this slice (author).

```

<!-- /omni-outbox-settled: s3-01-s3-repo-reader-lists-folders -->

<!-- omni-outbox-settled: s3-02-s3-which-folders-are-skills -->

## s3-02-s3-which-folders-are-skills — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s3
- Wave: 2
- Became: BR-PRODUCT-125, P-PRODUCT-103

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-s3-which-folders-are-skills
prd: 2313
slice: s3
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Which folders of a repository does the Runner skills block list? The spec leaves out a folder with no skill file or a bad name, but does not say what to do with a folder whose name differs from its skill's name, or one named like a skill of the loop itself.

## The decision, in plain words

The block lists a folder only when its skill name is valid and the same as the folder's name, and it leaves out the loop's own skill names, since those can never be allowed.

## The intro, for fun

Some folders wear a name tag that does not match the door.

## The punchline, for fun

The block only opens doors whose tag and number agree.

## The options, in plain words

A. A. List only skills whose name is valid, equals their folder and is not a loop skill, as built.
B. B. List every folder with a skill file, and show a skill that cannot be allowed as disabled.

## What I had to decide

Whether a skill whose name differs from its folder, or that shares a name with the loop's own skills, is listed. Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Built as the narrow rule: a runner finds a skill by its folder, and the database refuses the loop's own names.

## What it costs to change later

Undone by changing one condition in the skills reader.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether Claude accepts a skill whose frontmatter name differs from its folder was not checked (author).

```

<!-- /omni-outbox-settled: s3-02-s3-which-folders-are-skills -->
