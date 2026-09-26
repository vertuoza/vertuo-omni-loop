# `kit/templates/playbook/releasing.md`

Source: `docs/agents/releasing.md` @ `vertuo-ai-domain@db67fd9da`. The kit default of the releasing
form: slots `publishes`, `how`, `rollback`, in the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `main` ("Nothing is ever committed back to `main`") | `{config:repo.defaultBranch}` (slot `how`) |

## Dropped (repository literals)

- **The release's names:** the AI layer, the studio, ADR 0064, `.github/workflows/release.yml`,
  `apps/`, `libs/`, `pnpm-lock.yaml` as the Shipping-change paths, `.claude/`, `.github/`, QA, the
  `v*` tag, `0.0.0-dev` in `package.json`, `git tag --list 'v*' --sort=-v:refname`,
  `curl … /api/health | jq -r .release`. Kept: merging releases; a change ships something or
  nothing, and you know which (slot `publishes`); nothing is committed back; the version lives on
  the tag; a running service says its release, and a development version was not built by the
  pipeline (slot `how`).
- **The OpenAPI snapshot cut, whole:** the `cut` job, `apps/vertuoza-rest-api/openapi/v<next>.json`,
  `OPENAPI_CUT_DEPLOY_KEY`, ADR 0049, `pnpm check:openapi-label`, `scripts/next-release.mjs`,
  PRD #988.
- **Getting the Release into the ERP, whole:** `apps/vertuo-front`, `vertuoza/vertuo-apps`,
  `@vertuoza/ai-agent-ui`, GitHub Packages, `.github/workflows/bump-ai-agent-ui.yml`, `bun.lock`,
  the caret range `^0.3.1` and the thirty-two Releases.
- **The labels' names:** `release:minor`, `release:major`, `acceptance-not-needed`. Kept: asking for
  more than a patch is a label on the pull request before it merges (slot `how`).
- **When something is on fire:** `workflow_dispatch`, the `ai-agent-ui-v*` and `advisor-ui-v*` tag
  triggers, `Deploy to QA`, `pnpm release`, the Actions tab. Kept: run the publishing workflow by
  hand for the release you mean; never publish from a workstation (slot `rollback`).
- **Changing the rules:** `scripts/next-release.mjs`, `next-release.test.mjs`. Kept: the rules that
  decide what ships live in code with tests beside them, never only in workflow configuration (slot
  `how`).

## Changed

- "If you missed it, the fix is to let the patch stand and put the label on the next Shipping
  change, not to retag by hand" reads "A release that went out with the wrong number stands, and the
  next shipping change corrects it: never retag by hand" (slot `rollback`).
- The upstream opening defines a Release; the form opens with the spec's "Use this page when …".

## Added

- The spec's slot markers and headings.
