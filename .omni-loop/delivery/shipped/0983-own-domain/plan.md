# Plan: Omni Loop on its own domain

PRD #983, specified in `spec.md` beside this plan. The feature branch `feat/own-domain` merges into
`main` through the feature PR (`Closes #983`); each slice is a sub-PR from `feat/own-domain--<slice>`
into the feature branch (`Part of #983`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Galaxy names one address: `SITE` is `https://www.omni-loop.xyz`, the root layout's `metadataBase`, canonical and `og:url` on the home page, `/releases` and every docs page, `robots.ts`, `sitemap.ts`, and the timings default | `apps/galaxy/app/` `apps/galaxy/src/releases/page/` `apps/galaxy/src/home/` `apps/galaxy/src/timings/` `apps/galaxy/src/seo/` `apps/galaxy/src/switch/render.test.ts` `apps/galaxy/src/switch/headers.test.ts` `apps/galaxy/src/proxy/proxy.test.ts` | — | 1 |
| s2 | The kit signs with the new address: `signature.home`'s default, the two guards without a host exception (the old host refused again), the kit tests that spell the address, the rebuilt bundle, this repository's `ask.url`, and the ADR amending ADR-0047 | `kit/` `.omni-loop/config.yml` `.omni-loop/knowledge/adr/0055-` | — | 1 |
| s3 | The omni-app follows: `DEFAULT_GALAXY_URL` (stage events and the canon judge) and the manifest's `setup_url` on the new address, with their tests and README lines | `apps/omni-app/` | — | 1 |
| s4 | The docs follow: the guide's address and its section on switching an installed repository, and galaxy's README with the address and the three human steps (Supabase, the GitHub App, Vercel) | `docs/guide/troubleshooting.md` `apps/galaxy/README.md` | — | 1 |

**Shared ground.** None: no prefix is declared by two slices, so all four build in wave 1. The
galaxy page tests that read the layouts and the home metadata (`src/switch/render.test.ts`,
`src/switch/headers.test.ts`, `src/proxy/proxy.test.ts`) are s1's alone. `apps/omni-app/README.md`
sits under s3's `apps/omni-app/`, and galaxy's README is s4's, outside every s1 prefix. The kit's
signed fixtures under `apps/omni-app/test/fixtures/` are recordings of past pull requests and keep
the address they were posted with; s3 changes them only if a test reads the default from them.

## Per slice: done when

**s1**
- `SITE` in `apps/galaxy/src/releases/page/address.ts` is `https://www.omni-loop.xyz`, and no file
  under `apps/galaxy/src/` or `apps/galaxy/app/` spells `vertuo-omni-loop-galaxy.vercel.app`.
- The home page, `/releases` and a docs page print `<link rel="canonical">` and `og:url` on
  `https://www.omni-loop.xyz`, tested on their metadata objects.
- `robots()` allows `/`, `/releases` and `/docs`, disallows the signed-in routes and names
  `https://www.omni-loop.xyz/sitemap.xml`; `sitemap()` lists the home page, `/releases` and every
  docs page on `SITE`. Both are unit-tested.
- `parseArgs([])` in `src/timings/run.ts` defaults `base` to `https://www.omni-loop.xyz`.
- No redirect is added: `proxy.ts` is unchanged in behaviour.

**s2**
- `node .omni-loop/bin/omni.mjs config signature.home` prints `https://www.omni-loop.xyz`, and
  `init.test.ts` proves `omni init` writes `ask.url: https://www.omni-loop.xyz`.
- `kit/test/no-literals.test.ts` has no `EXEMPT_VALUES` entry for a host, and
  `kit/test/no-game-words.test.ts` no `HOME_ADDRESS`; their tests prove the old host is refused in
  kit code and the new one passes in `lib/config.ts`.
- `kit/dist/omni.mjs` is rebuilt (`kit/test/dist.test.ts` green), and `.omni-loop/config.yml`'s
  `ask.url` is `https://www.omni-loop.xyz`.
- `.omni-loop/knowledge/adr/0055-…md` records the new address, names ADR-0047 as amended, lapses its
  decisions 2 and 3, and keeps decisions 4 and 5.

**s3**
- `DEFAULT_GALAXY_URL` is `https://www.omni-loop.xyz`; `judge.test.ts` expects
  `https://www.omni-loop.xyz/api/constituents/judge`.
- `app.yml`'s `setup_url` is `https://www.omni-loop.xyz/signup/installed`, its webhook lines
  unchanged, and `test/app-yml.test.ts` green.
- `apps/omni-app/README.md`'s stage-event step names the new address.

**s4**
- `docs/guide/troubleshooting.md` gives `https://www.omni-loop.xyz` as the address and holds the
  section *Your config still names vertuo-omni-loop-galaxy.vercel.app*, saying the old address
  keeps working and how to switch `ask.url` and `signature.home`.
- `apps/galaxy/README.md` names the new address and lists the three human steps from the spec.

Every slice: `pnpm test` green.
