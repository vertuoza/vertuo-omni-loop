# `kit/templates/playbook/decisions.md`

Source: `docs/adr/index.md` @ `vertuo-ai-domain@db67fd9da`, with the record shape of
`docs/adr/0058-identifiers-are-english-interface-copy-is-french.md` and "Records are never deleted"
from `docs/knowledge/README.md` › Decision record or principle?. The kit default of the decisions
form, which lives at `adr/README.md` under the front door: slots `where`, `format`, `numbering`, in
the spec's order.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `docs/adr/` (the folder the index sits in) | `{config:paths.adr}` (slot `where`) |
| `docs/knowledge/` ("is a principle") | "the knowledge registers" (slot `where`) |

## Dropped (repository literals)

- **The index table:** its 62 rows, each record's number, link and summary. Nobody keeps that list
  by hand: `omni kb show decisions` reads it from the folder (slot `numbering`).
- **PRD #1081**, and `docs/knowledge/README.md`'s "Decision record or principle?" link.
- **From ADR 0058:** its subject (identifiers and interface copy, Dossier and Folder), and its links
  to ADR 0037, 0040, 0055 and 0057. Only its shape is kept: a status line naming what it supersedes,
  then Decision, Considered options, Consequences (slot `format`). Its naming rule is the conventions
  form's (`naming`).

## Changed

- "Each ADR records _that_ a decision was made and _why_ — the hard-to-reverse,
  surprising-without-context choices a future reader would otherwise have to reverse-engineer" is
  kept nearly word for word in `format`.
- "A record that once stated one is trimmed to its mechanism and links the id instead" reads "A
  record that states a product decision is trimmed to its mechanism, and links the principle
  instead".

## Added

- The title "Decision records" and the opener: the index has neither in that form.
- `NNNN-<slug>.md` with four digits and the `# NNNN — <the decision>` title: the shape every
  upstream record follows, and the spec's (`NNNN-<slug>.md`).
- "A number belongs to one record": the before/after page found two upstream records sharing 0076.
- The spec's slot markers and headings.
