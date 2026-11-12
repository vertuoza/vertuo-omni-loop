# Bug 2758: /omni:drive cannot read a product roadmap's rows (omni dossier get <key>-R<n> roadmap refused)

## Triage

- **Domain:** product roadmaps (PRD 2011): the kit's `omni dossier get` and the app's `GET /api/dossiers/get`
- **Risk:** medium — whoever drives a product roadmap with `/omni:drive --roadmap <key>-R<n>` gets nothing driven; workaround: drive its PRDs by id (Jev, 0.98)
- **Regression:** new bug — no evidence this ever worked (PRD 2011's adopted item `s4-02-product-roadmap-drive-unread` left the read unbuilt)

## Reproduction

- **File:** `kit/bin/commands/dossier-product.test.ts`
- **Also:** `apps/galaxy/src/dossier/api-product.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected { code: 2, out: '', …(4) } to match object { code: +0, err: '' }` (kit) · `AssertionError: expected 400 to be 200` (app)

## Fix

`omni dossier get` took only a product PRD's id, and the get route only read a PRD's dossier, so the read the drive skills name for a product roadmap's rows did not exist. The kit now reads `<key>-R<n> roadmap` and writes the roadmap's latest `roadmap.md` to a scratch file, as it does a PRD's files. The route answers `?product=<key>&roadmap=<n>&kind=roadmap` from the roadmap's dossier, kept to the caller's workspaces by row-level security.

## Guard

none — the reproduction tests keep this read; the general guard, a check that every `omni` command a skill names parses, is larger than this fix

## Mutation

mutation: no changed core file against origin/main (f562fc36): nothing to mutate
