# `kit/templates/playbook/setup.md`

Source: `README.md` › Getting started, Ports, Workspace scripts @ `vertuo-ai-domain@db67fd9da`, with
the frozen-lockfile install from `docs/agents/verification.md` and "keep it out of the repo and out
of anything you print" from the same page. The kit default of the setup form: slots
`prerequisites`, `install`, `run`, `env`, in the spec's order.

## Read from config instead of hard-coded

Nothing: every value this form holds is the repository's own, and none is a config key.

## Dropped (repository literals)

- **Layout and Conventions:** `apps/vertuo-ai-api`, `apps/vertuo-ai-admin-ui`,
  `libs/vertuo-ai-contract`, `system-ai`, `system-logs`, the `@vertuo-ai/*` scope,
  `libs/LIBRARY_STYLE_RULES.md`, Zod-first, Changesets `fixed`. Layout is the architecture form's.
- **Getting started:** `pnpm install`, `pnpm doctor` and what it checks (Node 24, pnpm, lockfile,
  hook, `gh`, `origin`), `pnpm build`, `pnpm dev`, Turbo, `docs/guides/building-a-feature.md`, and
  the per-app `pnpm --filter … dev` lines. Kept: the pinned versions win over a written number, and
  one readiness check beats a drifting list (slot `prerequisites`).
- **Login wall:** Google Workspace, the http-only session cookie, ADR 0011, `AUTH_*`,
  `GOOGLE_OIDC_*`, `apps/vertuo-ai-api/.env`, `.env.example`, `AUTH_ADMIN_EMAILS`, `/api/docs`,
  `/api/auth/*`. Kept: settings come from the environment, an example file lists every variable,
  a secret is never committed (slot `env`).
- **Ports:** the port table (4000, 4001, 4200, 4300, 4301, 4400) and the app names in it. Kept: one
  fixed port per app, in one table checked before a new app picks its default (slot `run`).
- **Deployed QA URLs, the QA connector and its runbooks:** Cloud Run, `vertuoza-qa`,
  `europe-west1`, `.github/workflows/deploy.yml`, ADR 0017, the `run.app` hostnames,
  `gh release download qa-connect-latest`, `vertuo-mcp-connect`, Claude Desktop,
  `claude_desktop_config.json`, `ops/RUNBOOK-qa-connect-testing.md`,
  `MCP_URL_SESSION_ENABLED`, `QA_CONNECT_ENABLED`, `ops/RUNBOOK-qa-custom-domain.md`,
  `<name>.qa.vertuoza.app`.
- **Workspace scripts** (`pnpm build`, `typecheck`, `lint`, `test`, `format`, `changeset`) and
  **Adding a package** (`libs/LIBRARY_TEMPLATE.md`, `microPackageKind`).
- **From `verification.md`:** "frozen-lockfile install" as a preflight step; the door secret and
  `railway variables`. Kept: install exactly what the lockfile pins (slot `install`); a secret is
  never printed (slot `env`).

## Changed

- The upstream README is a page for people; the form keeps only the rules a newcomer's setup rests
  on, one slot each.

## Added

- The opener, "Use this page when getting a checkout ready …": the README has none.
- The spec's slot markers and headings.
