---
id: s17-03-app-needs-administration-permission
prd: 2011
slice: s17
rank: human-action
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

The GitHub App cannot archive a repository until someone with the right to change the App grants it one more permission. Will you grant it?

## The decision, in plain words

Making a repository read-only on GitHub needs the App to hold the administration permission, which it does not ask for today. The code is built and logs that GitHub refused when the permission is missing, but nothing becomes read-only until an administrator of the App adds the permission and accepts it on the installation.

## The intro, for fun

The App has the key to the building but not to the filing cabinet.

## The punchline, for fun

One tick in a settings page, and the cabinet locks.

## What a person must do

1. Add administration: write to default_permissions in apps/omni-app/app.yml and to the permission list in apps/omni-app/test/app-yml.test.ts (a follow-up change).
2. In the GitHub App's settings, add the Repository permission Administration: Read and write.
3. Accept the new permission on each installation that holds a plan repository, from the installation's page or the email GitHub sends.

## What I had to decide

Whether to widen the App's permissions with administration write, the only way to archive a repository through GitHub's API.

## What I did meanwhile

The App's manifest (apps/omni-app/app.yml) is untouched: it is outside this slice's territory and a test fails on any permission beyond those it lists. The plan-archive function treats a 403 from GitHub as 'left as it is', says so in the log, and tries again at the next check.

## What it costs to change later

Two files and one human step: add administration: write to default_permissions in app.yml and to its test's list, then an administrator of the App accepts the new permission on each installation.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I could not check from here which permissions the registered App holds today, or whether administration write is already granted on the installation of the plan repositories
