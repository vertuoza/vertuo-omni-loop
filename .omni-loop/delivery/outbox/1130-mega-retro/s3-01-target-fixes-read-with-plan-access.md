---
id: s3-01-target-fixes-read-with-plan-access
prd: 1130
slice: s3
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

On day 14, the retro reads the fixes a cross-repository bug names in each other repository. Should it read them with the access it holds on the planning repository, or ask for its own access on each one?

## The decision, in plain words

It reads them with the access it already holds on the planning repository. When that access does not reach a repository, the fix is listed as not read, and the retro carries on.

## The intro, for fun

Fourteen days on, the retro knocks on every door the bug fix walked through.

## The punchline, for fun

It brings one key; a door that will not open is written down, never forced.

## The options, in plain words

A. A. Read the fix pull requests with the plan repository's access, and list one it cannot reach as not read (built).
B. B. Pass each target's own installation to the after-merge kind, as the merge run's kinds get it, so a target under another installation is read too.
C. C. Read only the fixes in the plan repository, and leave the targets' fixes out of the day-14 look.

## What I had to decide

Whether the day-14 look should read a target's fix pull requests through that target's own installation of the App, as the merge run reads the target, rather than the plan repository's.

## What I did meanwhile

Fix pull requests in a target covered by the same installation as the plan repository (an organisation-wide install) are read and placed against that target's churn; one in a target under another installation is listed as not read, with GitHub's status.

## What it costs to change later

Switching to the target's own installation means handing the after-merge kind a way to sign in as each target (the retro function passes its client per target, as it does for the merge run's kinds): a change in the retro function and the kind registry, no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory is the after-merge kind only, and a kind's gather is handed one GitHub client, the plan repository's; reaching a target's installation needs the retro function to pass it, outside this slice.
- (author) Whether the App is installed organisation-wide on the repositories that use multi-repository PRDs was not checked.
