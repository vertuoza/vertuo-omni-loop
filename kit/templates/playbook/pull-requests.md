---
form: pull-requests
form-version: 1
state: blank
points-to: null
evidence: []
terraformed: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/pull-request.md — changes in kit/porting/templates--pull-requests.md -->

# Pull requests

Use this page when opening or updating a pull request.

## Body
<!-- slot: body · required -->
- Start from the repository's pull request template when it has one, and leave no placeholder:
  real content, `No impact`, or `Not applicable`.
- Keep the summary short. The reviewable detail goes in impact, validation, risk, rollback, and
  reviewer focus.
- Name the business area that owns the change, not the folder it touched, in the glossary's words;
  list the other areas it could affect. A rule or invariant cites its source of truth.
- Validation gives the exact commands that matter, manual steps a reviewer can run as written, and,
  for a skipped check, why and what evidence replaces it.
- Rollback is explicit, even when it is "revert this pull request". A change to stored data says how
  the data is recovered.

## Title
<!-- slot: title · optional -->
The title is a Conventional Commit, `<type>(<scope>): <summary>`, like the commits it carries.

## Labels
<!-- slot: labels · optional -->
Each kind of pull request carries its label: `{config:labels.feature}` for a feature,
`{config:labels.sub}` for a slice, `{config:labels.phase0}` for a phase-0 review. A pull request an
agent owns also carries `{config:labels.inProgress}` and a status comment the agent keeps current,
until it is green or stuck.

## Reviewers
<!-- slot: reviewers · optional -->
A person merges into `{config:repo.defaultBranch}`; an agent never does. Reviewer focus names the
parts of the change most worth scrutinizing.
