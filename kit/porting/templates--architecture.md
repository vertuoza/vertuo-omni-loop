# `kit/templates/playbook/architecture.md`

Source: `AGENTS.md` › Boundaries and `libs/LIBRARY_STYLE_RULES.md` @ `vertuo-ai-domain@db67fd9da`,
with "legible from the tree alone" from `docs/glossary.md` › Part. The kit default of the
architecture form: slots `layout`, `boundaries`, `patterns`, in the spec's order.

## Read from config instead of hard-coded

Nothing: layers, packages and checks are the repository's own.

## Dropped (repository literals)

- **The layer names and the arrow between them:** `apps -> vertuo-domain-* -> vertuo-ai-* ->
  system-*`, and each prefix's role (`apps/*`, `vertuo-domain-*`, `vertuo-ai-*`, `system-*`,
  `system-api-contract`). Kept: dependencies point down; a lower layer never imports a higher one
  (slot `boundaries`).
- **The inverted `ai → domain` rule** and why it was inverted (token accounting, prompt storage,
  LLM calls), and the AI-Feature Part. Kept: what two layers both need, and knows nothing of either,
  moves down to the lowest layer (slot `boundaries`).
- **The cross-part wall's specifics:** "a future second Part", `scripts/check-layering.mjs`. Kept:
  separate product areas meet only at the app's composition root (slot `boundaries`).
- **`pnpm check:layering`**, `scripts/check-file-naming.mjs` and "enforced in review". Kept: a
  boundary names the check that enforces it, or says only review does (slot `boundaries`).
- **Naming and publishing:** the `@vertuo-ai/*` scope, `@vertuoza/advisor-ui`,
  `libs/system-advisor-ui`, GitHub Packages, the legacy `cell-*` prefix, `LIBRARY_TEMPLATE.md`.
  Kept: a package's name says its layer (slot `layout`).
- **`microPackageKind`** and its `shared` / `server` / `mixed` kinds; the `src/shared/`,
  `src/server/`, `src/contracts/`, `src/index.ts` folder layout.
- **Zod:** `z.ZodSchema`, `z.infer`, the `listOptionsSchema` example. Kept: a value that crosses a
  boundary is validated there by a schema, and its type is derived from it (slot `patterns`).
- **Data access:** `Controller → Service → Repository → Database`, `*.repository.ts`,
  `*.service.ts`, `@vertuo-ai/system-db-core`, Kysely, inline `sql` strings, NestJS,
  `ZodValidationPipe`, `apps/vertuo-ai-api/src/common/zod-validation.pipe.ts`, the file-name
  examples, and the seven-item review checklist. Kept: storage is reached through one layer, the
  logic above it never queries, the transport calls the logic; a file's name says its role (slot
  `patterns`).
- **Capability descriptor modules:** `*.capability.ts`, `CapabilityRunService`, ADR 0051,
  `CapabilityRunDescriptor`, `LlmClient`.
- **Scripts:** root `/scripts/`, `libs/scripts/`. Kept: repository-wide scripts live in one place at
  the root, never inside a package (slot `layout`).
- **Versioning:** `.changeset/config.json`, `fixed: [["@vertuo-ai/*"]]`, `advisor-ui-v*`,
  `.github/workflows/publish-advisor-ui.yml`. A merge's publishing is the releasing form's.
- **From `AGENTS.md` › Boundaries:** `docs/agents/implementation-workflow.md`, "Never merge into
  `main`", `pnpm format`, `pnpm exec prettier --write`, `pnpm quality:preflight` and ADR 0061, the
  three commands and `/vertuo-planner`. Those are the briefing's and the verification form's.

## Changed

- `AGENTS.md` names the layers; the form states the rules any layering follows, and leaves the
  names to the repository's `layout` and `boundaries` sections.

## Added

- The opener, "Use this page when deciding where code goes …": neither page has one.
- The spec's slot markers and headings.
