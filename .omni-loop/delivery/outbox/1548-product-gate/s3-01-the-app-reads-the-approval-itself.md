---
id: s3-01-the-app-reads-the-approval-itself
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The check on a target pull request needs to know whether the plan was approved. Should the GitHub App read that record from the database itself, or ask the web app for it?

## The decision, in plain words

The App reads it from the database itself, the way it already reads a repository's business, and only for a product that lists the pull request's repository. A pull request naming a PRD of a product that does not hold its repository learns nothing of it.

## The intro, for fun

The robot at the door needed to see the signed permission slip.

## The punchline, for fun

It walks to the filing cabinet itself, but only opens its own team's drawer.

## The options, in plain words

A. A. The App reads the record as the service role, scoped to products holding the repository (built).
B. B. A signed galaxy route reads it and the App calls that route.
C. C. A new database function for the App, like business_for_repo_app.

## What I had to decide

Confirm the App reads a product PRD's approval, voids and latest versions as the service role, scoped by product_repositories, rather than through a signed call to a galaxy route.

## What I did meanwhile

apps/omni-app/src/approved-check/record.ts reads product_repositories (joined on products.key), dossiers, dossier_versions, approvals, workspace_members and approval_voids with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, the pair the pr-stats collector and the canon gate already use. Without that pair every approved check is held (neutral). No galaxy route or new secret was added, so env.ts is unchanged.

## What it costs to change later

Moving the read behind a galaxy route is a new route, a shared secret and swapping one reader passed to createApprovedCheck; the check's judgement and tests stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists apps/galaxy/src/approval/ for this slice as 'reads the approval for the check', which hints at a galaxy route; dossier_approval() checks who calls, and the App has no person's session, so a route would itself need the service role.
- (author) No boundary file was added for these reads, so pnpm schemas:verify does not check their shapes against production.
