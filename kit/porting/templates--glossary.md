# `kit/templates/playbook/glossary.md`

Sources: `CONTEXT.md` and `docs/glossary.md` @ `vertuo-ai-domain@db67fd9da`. The kit default of the
glossary form, a pointer-only form: its one slot, `where`.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `docs/glossary.md` (the page `CONTEXT.md` points to) | "`paths.glossary` in the config names the same page", in words: the key is `null` until a repository sets it, so a `{config:paths.glossary}` placeholder would show unfilled (item `s1-01-kit-default-names-an-unset-setting`) |

## Dropped (repository literals)

- **From `CONTEXT.md`:** `docs/glossary.md`, `docs/orientation/first-hour-words.md` and its
  twenty-term starter card, `docs/knowledge/` and `docs/knowledge/README.md`,
  `docs/architecture/`, `docs/adr/`. Kept: the glossary defines the words; the knowledge folder
  holds the rules.
- **From `docs/glossary.md`:** its title ("Glossary — Vertuo AI Domain"), "The repo-root `CONTEXT.md`
  points here", and every entry (Platform, Part, AI Feature, Page archetype, the REST façade, and
  the rest). Kept: definitions only, what a term is and not how it is implemented; the canonical
  word defined and the others listed under _Avoid_.

## Changed

- The upstream glossary's `_Avoid_` is written `*Avoid*` (the same emphasis).

## Added

- "When the repository keeps a glossary, this form points at it": the form is pointer-only in the
  spec.
- The opener, "Use this page when you need the word this repository uses for a concept".
- The spec's slot marker and heading.
