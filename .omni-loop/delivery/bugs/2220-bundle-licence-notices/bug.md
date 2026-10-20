# Bug 2220: the built kit drops the licence notices of the libraries it bundles (zod, yaml)

## Triage

- **Domain:** the kit's build and distribution (`kit/build.ts`, `kit/dist/`)
- **Risk:** medium — everyone who installs the kit receives zod, yaml and React without the copyright and permission notice their MIT and ISC licences require, so each copy distributed breaches those licences; nothing breaks at runtime, and only a rebuild fixes it.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/test/dist-notices.test.ts`
- **Red:** `AssertionError: kit/dist/omni.mjs lacks the notice of node_modules/.pnpm/yaml@2.9.1/node_modules/yaml: expected false to be true // Object.is equality`

## Fix

`kit/build.ts` built both bundles with `legalComments: 'none'`, and zod and yaml mark no legal comment
esbuild would keep anyway, so no licence text reached `kit/dist`. The build now asks esbuild for its
metafile and ends each built file with a `Third-party notices` comment holding, for every bundled
package (zod, yaml, and the pitch engine's react, react-dom and scheduler), its name, version, licence
and licence file verbatim; the CLI bundle carries the engine's packages too. `kit/NOTICE.md` says so.

## Guard

`kit/test/dist-notices.test.ts` asks esbuild on its own which packages each entry bundles and fails
when a committed file of `kit/dist` lacks one package's notice; the build itself throws when a bundled
package ships no licence file.

## Mutation

mutation: no delivery-core file changed (kit/build.ts and kit/dist are outside Stryker's scope)
