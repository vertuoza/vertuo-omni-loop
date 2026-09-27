---
form: releasing
form-version: 1
state: blank
points-to: null
evidence: []
invaded: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/releasing.md — changes in kit/porting/templates--releasing.md -->

# Releasing

Use this page when you need to know what a merge publishes.

## What a merge publishes
<!-- slot: publishes · required -->
You do not cut a release: merging does. Every merge is either a shipping change, something a
deployed service or a published package actually contains, or one that ships nothing, such as docs,
specs, or tooling. Know which one yours is before it merges.

## How a release happens
<!-- slot: how · optional -->
- The rules that decide what ships and what the next version is live in code, with tests beside
  them, never only in workflow configuration.
- A release commits nothing back to `{config:repo.defaultBranch}`: the version lives on its tag.
- Asking for more than a patch is a label on the pull request before it merges; a label added after
  the merge does nothing.
- A running service can say which release it is. One that answers a development version was not
  built by the pipeline.

## Rollback
<!-- slot: rollback · optional -->
When something is on fire, run the publishing workflow by hand for the release you mean; never
publish from a workstation. A release that went out with the wrong number stands, and the next
shipping change corrects it: never retag by hand.

## Release notes
<!-- slot: notes · optional -->
When `releaseNotes.enabled` is on in the config, every PRD ships with a release note: `release.md`
in its folder, beside `spec.md`. It is written at ship, from the spec and from what the branch
actually built, never from the plan, and whoever merges the pull request approves its words.
`omni check releases` grades every note, and ship refuses a PRD without one that passes.

- **Front matter:** `prd`, the folder's number, and `title`. Only the initial release's notes add
  `version: 0.0.1`; a note written at ship never carries a version. Nothing else.
- **Title:** what the change is worth to the people who use it, catchy, in sentence case. One line,
  60 characters at most, no final full stop. No PRD or pull request number, no code, no delivery
  jargon; product names are fine.
- **Description:** the body, one paragraph of one to three sentences, 280 characters at most.
  Neutral and factual, in the present tense: what changed, and for whom. No superlatives, no links,
  no issue references, no code, no file paths, no people's names.

```markdown
---
prd: 12
title: Share a report with anyone, no account needed
---
Every report has a public link that opens without signing in. The owner can switch the link off
at any time, and a report opened from it cannot be edited.
```

```markdown
---
prd: 31
title: Invoices in your customer's language
---
Invoices and their reminders are sent in the language set on the customer's record. Invoices sent
before keep the language they were sent in.
```

```markdown
---
prd: 57
title: Find any project as you type
---
A search box at the top of every page finds projects, clients and documents by name while you
type, the most recently opened first.
```
