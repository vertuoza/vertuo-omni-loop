# Settled outbox items — PRD 347

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-unversioned-skips-latest -->

## s1-01-unversioned-skips-latest — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-unversioned-skips-latest
prd: 347
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When the running tool carries no version number at all, should the version command still say whether a newer release exists?

## The decision, in plain words

It says only that it is unversioned and does not ask GitHub, because without a number it cannot tell older from newer. From the tool's own source with no number yet, it says unversioned and source.

## The intro, for fun

A tool with no version number walks into a release party and asks if it is late.

## The punchline, for fun

Nobody can tell, so it just says unversioned and stays quiet.

## The options, in plain words

A. Unversioned prints one line, no GitHub call (built).
B. Unversioned also prints the latest release and says to run the update command.

## What I had to decide

Whether an unversioned build should also print the latest release and point to the update command.

## What I did meanwhile

An unversioned build prints one line and never asks GitHub; a numbered build compares as the spec says.

## What it costs to change later

A constant in one function: printing the latest line for an unversioned build is a two-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the unversioned first line but not whether GitHub is asked after it (author).

```

<!-- /omni-outbox-settled: s1-01-unversioned-skips-latest -->

<!-- omni-outbox-settled: s2-01-release-commit-author -->

## s2-01-release-commit-author — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-release-commit-author
prd: 347
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Whose name should the automatic release commit on the main branch carry as its author?

## The decision, in plain words

The release commit is authored by the standard GitHub Actions bot account, and also names Omni-man as co-author. The hosting of the two web apps may refuse to deploy a commit whose author is not a team member, which would leave their production one step behind until someone deploys by hand.

## The intro, for fun

Every merge now ends with a tiny commit nobody typed.

## The punchline, for fun

Somebody has to sign the guest book, even a robot.

## The options, in plain words

A. The GitHub Actions bot authors it, the account the workflow's token pushes as (built).
B. Omni-man authors it: the signature's name and address as author and committer, the trailer kept.
C. The person whose merge started the run authors it, read from the push event, so the hosting sees a team member.

## What I had to decide

Keep the Actions bot as the release commit's author, or author it as Omni-man, or as the person whose merge started the run.

## What I did meanwhile

The release workflow authors and commits as github-actions[bot] (GIT_AUTHOR_* and GIT_COMMITTER_* in .github/workflows/release.yml), with the Omni-man trailer in the message.

## What it costs to change later

A constant: four environment lines in the workflow. Nothing stored changes; past release commits keep their author.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Vercel projects of apps/galaxy and apps/omni-app block a deployment of a commit authored by github-actions[bot] was not checked (author).
- Whether Vercel deploys a push made with the workflow's own token at all was not checked (author).

```

<!-- /omni-outbox-settled: s2-01-release-commit-author -->

<!-- omni-outbox-settled: s3-01-update-cleans-up-after-itself -->

## s3-01-update-cleans-up-after-itself — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-update-cleans-up-after-itself
prd: 347
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When the update has prepared its change in a separate working copy, should that copy be kept on the person's machine or thrown away once the change is sent for review?

## The decision, in plain words

It is thrown away as soon as the change is pushed and the review request is open, or as soon as the update stops. A later run that finds a leftover copy of the same update starts it again from scratch.

## The intro, for fun

The update builds its change in a spare room so the person's desk stays tidy.

## The punchline, for fun

Once the change is posted, it sweeps the spare room too.

## The options, in plain words

A. Remove the working copy once the change is pushed or the update stops (built).
B. Keep the working copy, so a person can look at or amend the change before it is reviewed.
C. Keep it only when the update stops early, so a person can see where it stopped.

## What I had to decide

Whether the separate working copy the update prepares its change in stays after the review request is open, and what a rerun does with a copy an earlier run left behind.

## What I did meanwhile

The copy is removed once the change is pushed or the update stops; a rerun resets the same update branch and starts over, and the check for an already-open review request runs before anything is written.

## What it costs to change later

One line: dropping the removal keeps the copy; nothing is stored anywhere that would need migrating.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says where the working copy is made but not whether it is kept afterwards (author).

```

<!-- /omni-outbox-settled: s3-01-update-cleans-up-after-itself -->

<!-- omni-outbox-settled: s4-01-installed-version-from-the-bin -->

## s4-01-installed-version-from-the-bin — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-installed-version-from-the-bin
prd: 347
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When the update command is started from the latest kit fetched on the fly, rather than from the copy the repository keeps, how does it know which version the repository really runs?

## The decision, in plain words

It reads the version written inside the repository's own copy of the tool, and treats a copy with no version as the oldest one, so a repository installed before versions still gets its update pull request.

## The intro, for fun

Asking the newest tool how old the repository is gives a very flattering answer.

## The punchline, for fun

So we check the birth certificate on the repository's own copy instead.

## The options, in plain words

A. Compare the target with the version the repository's bin carries, and apply in place when the running omni is the target (built).
B. Compare with the running omni's version only, as the spec words it, and have the README tell unversioned repositories to pass an explicit --to.
C. Ask the repository's bin itself for its version by running it, and treat a bin with no version command as unversioned.

## What I had to decide

Whether omni update compares the target with the version the repository's bin carries, read from the marker the build writes, rather than with the running omni's own version.

## What I did meanwhile

omni update reads the installed version from .omni-loop/bin/omni.mjs (the running version when that bin is the one running, else the marker the build stamped, null without one). When the running omni is the target but not the repository's bin, as with npx github:vertuoza/vertuo-omni-loop update, it applies itself with no download.

## What it costs to change later

A constant: the comparison lives in kit/lib/update/installed.mjs and kit/bin/commands/update.mjs. Reading the marker leans on how esbuild prints a define; if that shape changes, the bin reads as unversioned and the update opens a pull request that may change nothing but the bin.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the running version is compared with the target; taken literally, npx on an unversioned repository runs the latest bundle and reports up to date, so acceptance criterion 9 could not hold. Not asked of a person.

```

<!-- /omni-outbox-settled: s4-01-installed-version-from-the-bin -->

<!-- omni-outbox-settled: s4-02-plugin-step-after-a-failed-update -->

## s4-02-plugin-step-after-a-failed-update — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-plugin-step-after-a-failed-update
prd: 347
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When bringing the repository up to date fails, should the update still refresh the Claude plugin on the person's machine?

## The decision, in plain words

No: the plugin is refreshed only when the repository step went through, whether it opened a pull request, found one open, or found nothing to do. A failed run changes nothing, and the person reruns it once the cause is fixed.

## The intro, for fun

The repository tripped on the stairs, so should the plugin still take the elevator up?

## The punchline, for fun

For now everyone waits at the bottom together.

## The options, in plain words

A. Refresh the plugin only when the repository step exited 0 (built).
B. Refresh the plugin after every repository step that got past finding the target, whatever its exit code.
C. Refresh the plugin on every run, even when the target could not be found.

## What I had to decide

Whether omni update skips the plugin step when the repository step exits non-zero (an unknown target, GitHub out of reach, a config.yml that fails, a failed push).

## What I did meanwhile

The plugin step runs after the repository step only when it exited 0; up to date and from the kit's source count as 0. A failed repository step leaves the plugin alone, and omni update exits with the repository step's code.

## What it costs to change later

A constant: one condition in kit/bin/commands/update.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a plugin that did not update stops nothing, and that the pull request is already open by then; it does not say what happens to the plugin when the repository step itself fails.

```

<!-- /omni-outbox-settled: s4-02-plugin-step-after-a-failed-update -->
