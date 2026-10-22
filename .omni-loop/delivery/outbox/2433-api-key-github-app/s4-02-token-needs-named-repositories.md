---
id: s4-02-token-needs-named-repositories
prd: 2433
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When the server asks GitHub for a token on a key's App, may it ask without naming repositories, or for a repository that belongs to someone other than the owner of the installation?

## The decision, in plain words

No. It refuses to ask for a token without at least one repository, and refuses a repository whose owner is not the installation's, so a job's token never reaches further than the repositories it was asked for.

## The intro, for fun

A token with a blank list would open every door in the street.

## The punchline, for fun

So the list is never blank, and never from another street.

## The options, in plain words

A. A. Refuse an empty list and a repository of another owner before asking GitHub, so a token can only ever cover named repositories of the installation.
B. B. Pass the list on as given and let GitHub scope an empty one to every repository of the installation, which gives a job more reach than the repositories it was sent for.
C. C. Refuse only an empty list and leave the owner check to GitHub, which then looks a namesake up in the installation's own account.

## What I had to decide

GitHub reads an empty list of repositories as every repository the installation covers, and it takes repository names only, looking each one up in the account that holds the installation, so a namesake owner's repository would be looked up in the wrong account. The spec says a token for the given repositories with exactly three write permissions and metadata read, so I made the module that mints refuse both cases before it asks GitHub.

## What I did meanwhile

mintToken in keys/github-app.ts throws before any call when the list is empty or when a repository's owner differs from the installation's account, in any letter case, and sends each name once. keys/github-app.test.ts names both refusals.

## What it costs to change later

Small. Dropping either guard is a few lines of one function and its test; nothing stored depends on them, and the later slices that mint only import the function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How a key with no allow-list, which means every repository of its workspace, gets a token for the one repository a job targets: the slices that mint decide it (author)
