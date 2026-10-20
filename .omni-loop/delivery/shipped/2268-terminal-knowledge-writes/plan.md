# Plan: Add and edit a product's knowledge from the terminal

PRD #2268, specified in `spec.md` beside this plan. Built on the feature branch
`feat/terminal-knowledge-writes` into `main`, whose PR says `Closes #2268`; each slice is a sub-PR
from `feat/terminal-knowledge-writes--<slice>` into the feature branch, saying `Part of #2268`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `POST /api/knowledge/changes` adds and edits a Legal entry, a Glossary term or a constituent as the bearer's own session, through `knowledge_product_for_repo`, the product-knowledge service and the constituent functions, answering `{done, id, url}` or `{error}` | `supabase/migrations/` `supabase/checks/knowledge_product_for_repo.sql` `supabase/database.types.ts` `apps/galaxy/app/api/knowledge/` `apps/galaxy/src/knowledge-api/` | — | 1 | deep |
| s2 | `omni kb legal add` and `edit`, `omni kb glossary add` and `edit` call the route through `changeKnowledge` and print `added`, `edited` or `proposed` with the link, exit 1 on a refusal, 2 on wrong usage, `--json` and `--product` | `kit/lib/ask/client` `kit/bin/commands/kb.ts` `kit/bin/kb-` `kit/test/fake-ask-server.ts` `kit/lib/help/` | — | 1 | build |
| s3 | `omni constituents add --statement` or `--never`, and `omni constituents edit statement` or `never#<n> --text`, the same way | `kit/bin/commands/constituents.ts` `kit/bin/constituents` `kit/lib/constituents/` `kit/test/fake-ask-server.ts` `kit/lib/help/` | s2 | 2 | build |
| s4 | The `/omni:knowledge-add` skill: one item, shown whole, Yes / Change / Cancel, a missing field asked never filled, nothing written unattended, the next item only after | `kit/plugin/skills/knowledge-add/` `kit/test/plugin.test.ts` `kit/test/skill-steps.snapshot.json` `kit/lib/help/` | s3 | 3 | build |

**Shared ground.**

- `kit/lib/help/`: s2 lists the `kb` sub-commands, s3 the `constituents` ones, s4 the skill; the help's
  own tests (`entries.test.ts`) read all three. Waves 1, 2 and 3.
- `kit/test/fake-ask-server.ts`: s2 adds the `/api/knowledge/changes` route to the fake; s3 reuses it
  for constituents. Waves 1 and 2.
- s1 and s2 meet only through the route's contract in the spec (body and answers); s2 is tested
  against the fake, so both are in wave 1.
- `kit/dist/` is rebuilt by the wave, never by a slice.

## Per slice: done when

### s1 (deep: a write route for terminal tokens, acting in the person's name) (`ui: yes`)

- A migration, dated after the newest on `main`, adds `knowledge_product_for_repo(p_repo, p_product)`:
  the caller's workspace for the repository (`business_workspace`), then the named product or the
  repository's only product; several unnamed refuses with their names; an archived product refuses.
- `supabase/checks/knowledge_product_for_repo.sql` covers one product, several, none, another
  workspace's repository and an archived product.
- The route authenticates the bearer (`authenticate()`), runs as `supabaseAs(token)`, and: as the
  section's owner adds a Legal entry (`applied`, its id and url); as a member proposes (`proposed`);
  edits only the fields given; a member changing a constituent is 403; several products without
  `product` is 409; an unknown item is 404; no token is 401. Tests prove each.
- Every change is recorded as the caller's, as on the page.

### s2

- `omni kb legal add --code --statement --source`, `omni kb legal edit <id> [--statement] [--source]`,
  `omni kb glossary add --term --meaning [--avoid]`, `omni kb glossary edit <term> [--meaning] [--avoid]`
  print `added <id> · <url>`, `edited <id> · <url>` or `proposed · waits for @<owner> · <url>`.
- An edit with no field, or a missing required flag, exits 2 with the usage; a refusal, signed out or
  unreachable exits 1 with one line; `--json` prints the route's answer; `--product` is sent.
- End-to-end tests through `main()` against the fake server prove each; `omni help kb` lists them.

### s3

- `omni constituents add --statement "<text>"` / `--never "<text>"` and
  `omni constituents edit statement|never#<n> --text "<text>"` behave as s2's, with a member's refusal
  exiting 1 in the database's words.
- The read `omni constituents` is unchanged, and its cache is never written by a change.
- End-to-end tests prove each; `omni help constituents` lists them.

### s4

- `kit/plugin/skills/knowledge-add/SKILL.md` says: one item per Yes; the item shown whole (kind, id,
  every field); Yes / Change / Cancel; a field the person did not give is asked, never filled; avoid
  words empty unless named; no write under `OMNI_UNATTENDED`; edits only the item named; the next item
  only after the last one's line printed; it runs the commands of s2 and s3 with `--json`.
- `kit/test/plugin.test.ts` asserts each of those rules in the text; `omni help` lists the skill.
