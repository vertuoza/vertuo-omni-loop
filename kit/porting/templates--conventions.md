# `kit/templates/playbook/conventions.md`

Sources, all @ `vertuo-ai-domain@db67fd9da`: `docs/agents/briefing.md` (formatting),
`docs/agents/definition-of-done.md` › Commit Shape (commits), and
`docs/adr/0058-identifiers-are-english-interface-copy-is-french.md` (naming). The kit default of
the conventions form: slots `naming`, `formatting`, `commits`, in the spec's order, all optional.

## Read from config instead of hard-coded

Nothing: formatter, languages and scopes are the repository's own.

## Dropped (repository literals)

- **From the briefing:** `pnpm format`, "~760 files", `pnpm exec prettier --write <files>`. Kept:
  format only what you touched; a whole-tree run makes a pull request unreviewable; old drift is its
  own change (slot `formatting`).
- **From ADR 0058, the languages:** "Identifiers are English, interface copy is French", French as
  the canonical interface language, ADR 0037, ADR 0040, ADR 0055, ADR 0057, register 3 (model-facing
  text, the `<dossier>` element), and the whole Dossier → Folder rename: `dossierId`, `dossiers`,
  `FolderSummary`, `folderId`, `/folders`, `folders.*` keys, `@vertuo-ai/vertuo-domain-folder`,
  `system-api-contract`, `folder-briefing.composer.ts`, `composeFolderBlock`, the 97 catalog keys,
  `pnpm i18n:catalogs`, `Devis`, `Ouvrage`, `Chantier`, `check:leftovers`, the changesets, the
  migration keys, `P-PRODUCT-11`, `docs/glossary.md` and
  `docs/delivery/archive/specs/2026-09-02-dossier-to-folder-design.md`. Kept: identifiers and the
  words a user reads are separate questions; identifiers use the one language the code already uses;
  conflating the two lets a label leak into a table name (slot `naming`).
- **From Commit Shape:** "for PR work" (every commit follows it here).

## Changed

- ADR 0058's register 1 list (types, functions, variables, filenames, package names, database tables
  and columns, route segments, interface-catalog keys, stored enum literals, configuration keys)
  reads "types, functions, files, packages, tables and columns, routes, message keys, stored values,
  config keys".

## Added

- The title "Conventions" and the opener: none of the three sources is a conventions page.
- The spec's slot markers and headings.
