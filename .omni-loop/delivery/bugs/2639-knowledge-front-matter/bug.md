# Bug 2639: the arcade's production build fails on the Knowledge page's front matter

## Triage

- **Domain:** the guide at /docs (`docs/guide`, `apps/galaxy/src/docs`)
- **Risk:** high — nobody can ship the arcade: every production deploy since v0.0.584 fails, with no workaround but this fix; the live site keeps serving the v0.0.583 build (Jev, 0.63)
- **Regression:** yes — #2628 added `docs/guide/knowledge.md`, whose description holds an unquoted `: `; 335ed36 built green, e43ed4f red

## Reproduction

- **File:** `apps/galaxy/src/docs/guide.test.ts`
- **Level:** unit
- **Red:** `FAIL  apps/galaxy/src/docs/guide.test.ts > docs/guide > knowledge: its frontmatter is YAML the build can read (#2639)`

## Fix

The description of the Knowledge page held a `: ` with no quotes, which YAML reads as a nested mapping, so the build stopped on that page. The guide's own guard read each page's title with a regular expression and never saw it. The description is now quoted.

## Guard

The reproduction is the guard: each page of the guide must have front matter the `yaml` package reads, the same package the build's error came from. It runs in `pnpm test`, so a page like this one fails before merge.

## Mutation

mutation: no changed core file against origin/main (0f3f51fe): nothing to mutate
