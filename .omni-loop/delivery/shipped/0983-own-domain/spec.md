---
prd: 983
title: Omni Loop on its own domain
blocked-by: none
spec: file
---

# Omni Loop on its own domain

**Date:** 2026-10-02 · **PRD:** #983 · **Amends:** ADR-0047 (the address `signature.home` defaults to)
· **Touches:** `apps/galaxy/src/releases/page/address.ts`, `apps/galaxy/app/` (the root layout, the
home and docs metadata, a new `robots.ts` and `sitemap.ts`), `apps/galaxy/src/timings/run.ts`;
`kit/lib/config.ts`, `kit/test/no-game-words.test.ts`, `kit/test/no-literals.test.ts` and the kit
tests that spell the address, `kit/dist/omni.mjs` (rebuilt), `.omni-loop/config.yml`, a new ADR;
`apps/omni-app/src/stage-forward/stage-forward.ts`, `apps/omni-app/app.yml` and their tests;
`docs/guide/troubleshooting.md`, `apps/galaxy/README.md`, `apps/omni-app/README.md`. **Out of
scope:** anything under `.omni-loop/delivery/shipped/` (history stays as written), a redirect between
the two hosts, rewriting the config of repositories already installed.

## Problem

Omni Loop's web app is live at `https://www.omni-loop.xyz` (Vercel DNS, HTTPS, the apex answering
308 to `www`), and it is still live at `https://vertuo-omni-loop-galaxy.vercel.app`. Nothing in the
repository knows the new address yet (measured 2026-10-02):

- `/releases` names `vertuo-omni-loop-galaxy.vercel.app` as its canonical address and its `og:url`,
  on both hosts. The home page and the docs name no canonical address at all, so a search engine sees
  two copies of every page.
- `https://www.omni-loop.xyz/robots.txt` and `/sitemap.xml` answer 404.
- The kit's `signature.home` defaults to the vercel.app address, so every signed pull request and
  issue links there, and `omni init` writes it as a new repository's `ask.url`.
- The omni-app's galaxy default (`DEFAULT_GALAXY_URL`, which the stage events and the canon judge
  call) and the GitHub App manifest's `setup_url` name the vercel.app host.
- The guide and the two apps' READMEs tell people the vercel.app address.

Sign-in itself already works on any host: every OAuth return address is built from the host the
visitor is on (`window.location.origin`, or the forwarded host on the server). What blocks sign-in on
the new domain is outside the repository: the allow-lists of Supabase Auth and of the GitHub App.

## Solution

1. **Galaxy names one address.** `SITE` in `apps/galaxy/src/releases/page/address.ts` becomes
   `https://www.omni-loop.xyz`, and every canonical address galaxy prints is read from it:
   - the root layout sets `metadataBase` to `SITE`;
   - the home page, `/releases` and every docs page carry `alternates.canonical` and `og:url` on
     `SITE`, whichever host served them;
   - `app/robots.ts` allows `/`, `/releases` and `/docs`, disallows every other route (the app, the
     PRD, ask, knowledge, play, signup, auth and API routes), and names `${SITE}/sitemap.xml`;
   - `app/sitemap.ts` lists the home page, `/releases` and every docs page, each on `SITE`;
   - `src/timings/run.ts`'s default base is `SITE`.
2. **The kit signs with the new address.** `signature.home` defaults to `https://www.omni-loop.xyz`
   in `kit/lib/config.ts`, so `omni init` writes it as `ask.url` too. The new host holds neither the
   game's word nor the repository's name, so the one exception each guard kept for the old host
   (`HOME_ADDRESS` in `kit/test/no-game-words.test.ts`, `EXEMPT_VALUES` in
   `kit/test/no-literals.test.ts`) is removed, and the guards' own tests are rewritten so that the old
   host is refused again in kit code. `kit/dist/omni.mjs` is rebuilt. This repository's
   `.omni-loop/config.yml` sets `ask.url` to the new address.
3. **A new ADR amends ADR-0047.** Its address is now `https://www.omni-loop.xyz`, and its decisions 2
   and 3 (the guard exceptions) lapse because the host needs none. ADR-0047's decisions 4 and 5 hold:
   the kit's own `ask.url` default stays `null`.
4. **The omni-app follows.** `DEFAULT_GALAXY_URL` becomes `https://www.omni-loop.xyz`, and the
   manifest's `setup_url` becomes `https://www.omni-loop.xyz/signup/installed`. The webhook `url`
   lines, which point at the omni-app's own project, do not change.
5. **The docs follow, and say how to switch.** `docs/guide/troubleshooting.md` and both READMEs give
   the new address. The guide gains a section, *Your config still names
   vertuo-omni-loop-galaxy.vercel.app*: it says the old address keeps working, and that a repository
   switches by setting `ask.url` (and `signature.home`, when it set one) to
   `https://www.omni-loop.xyz` in `.omni-loop/config.yml`. `apps/galaxy/README.md` lists the human
   steps below.

### Human steps (outside the repository)

None of these is taken by the code. They are listed in `apps/galaxy/README.md` and can be done
before this PRD merges.

1. **Supabase**, Authentication › URL Configuration: add `https://www.omni-loop.xyz/**` and
   `https://omni-loop.xyz/**` to Redirect URLs, keeping the vercel.app, preview and localhost
   entries. Set the Site URL to `https://www.omni-loop.xyz`.
2. **The GitHub App**: add `https://www.omni-loop.xyz/prd/github/callback` to its Callback URLs,
   keeping the vercel.app one; set its Setup URL to `https://www.omni-loop.xyz/signup/installed`.
3. **Vercel**: keep both `www.omni-loop.xyz` and `vertuo-omni-loop-galaxy.vercel.app` on the galaxy
   project, with no redirect between them.

## Decisions

1. **Both hosts stay fully working** (the person, 2026-10-02): no redirect from the vercel.app host.
   Signed links already posted, and every installed repository's `ask.url`, keep working. Only the
   canonical address moves.
2. **Full move, through a PRD** (the person, 2026-10-02): the kit default changes too, not only the
   site, because it amends ADR-0047.
3. **Installed repositories are told, not rewritten** (the person, 2026-10-02, answering the
   objection below): the guide says how to switch; no command rewrites a repository's config.
4. **Only public pages are indexed** (assumed, written back in the design and approved): `/`,
   `/releases`, `/docs`. Everything behind sign-in stays out of the index.
5. **No proof video** (the person, 2026-10-02).
6. **The voice's objection.** persona:Lead Engineer: "My teams' repos already carry the old address
   in their config. I don't want a domain change I have to chase across every repository." Settled
   `accepted`: Decisions 1 and 3.

## User stories

- As someone who receives a link to Omni Loop, I open `https://www.omni-loop.xyz` and can sign in
  there, as I can on the vercel.app address.
- As a search engine, I find one canonical address for each public page, a `robots.txt` and a
  sitemap.
- As a repository installing the kit, my signatures and my ask mode use `https://www.omni-loop.xyz`.
- As a lead engineer with repositories already installed, nothing breaks, and the guide tells me how
  to switch when I want to.

## Scope

In: the galaxy metadata, robots and sitemap; the kit's `signature.home` default and its two guards;
this repository's `ask.url`; the omni-app's galaxy default and manifest; the ADR; the guide and the
READMEs. Out: shipped PRD folders, redirects, migrations of other repositories' configs, the Supabase
and GitHub App settings themselves (human steps).

## Test seams

- `apps/galaxy`: unit tests on the metadata objects (`alternates.canonical`, `openGraph.url` on
  `SITE` for home, `/releases` and a docs page), on `robots()` (allowed and disallowed paths, the
  sitemap line) and on `sitemap()` (home, `/releases`, every docs page, each on `SITE`).
- `kit`: `config.test.ts` and `init.test.ts` read the new default; the guards' tests prove that the
  new host passes in `lib/config.ts` and that the old host is refused again (`no-literals` for
  "vertuo", `no-game-words` for "galaxy").
- `apps/omni-app`: `judge.test.ts` and the stage-forward tests read the new default;
  `test/app-yml.test.ts` stays green.
- No test calls GitHub or Supabase.

## Risks

A merge to `main` publishes the kit (`kit/dist/omni.mjs` and the plugin): from then on, new
installations sign with and write `https://www.omni-loop.xyz`. If that domain lapsed, those links
would break. Rollback: revert the merge commit; old links keep working whatever happens, because the
vercel.app host is unchanged. Galaxy's and the omni-app's Vercel projects redeploy with the new
metadata and default. No migration. Sign-in on the new host needs the Supabase and GitHub App human
steps; without them, the new host still serves every page and sign-in works on the vercel.app host
as today.

## Acceptance criteria

1. `https://www.omni-loop.xyz/releases` and `https://vertuo-omni-loop-galaxy.vercel.app/releases`
   both print `<link rel="canonical" href="https://www.omni-loop.xyz/releases">`; the home page and
   a docs page print a canonical on `https://www.omni-loop.xyz` too.
2. `https://www.omni-loop.xyz/robots.txt` answers 200, allows `/`, `/releases` and `/docs`,
   disallows the signed-in routes, and names `https://www.omni-loop.xyz/sitemap.xml`.
3. `https://www.omni-loop.xyz/sitemap.xml` answers 200 and lists the home page, `/releases` and
   every docs page on `https://www.omni-loop.xyz`.
4. `omni config signature.home` prints `https://www.omni-loop.xyz` in a repository that does not set
   it, and `omni init` writes `ask.url: https://www.omni-loop.xyz`.
5. `kit/test/no-literals.test.ts` and `kit/test/no-game-words.test.ts` hold no exception for any
   host, and refuse `vertuo-omni-loop-galaxy.vercel.app` in kit code.
6. The omni-app posts stage events to `https://www.omni-loop.xyz` when `GALAXY_URL` is unset, and
   `app.yml`'s `setup_url` is `https://www.omni-loop.xyz/signup/installed`.
7. A new ADR records the change and names ADR-0047 as amended.
8. `docs/guide/troubleshooting.md` holds the section on switching an installed repository, and
   `apps/galaxy/README.md` lists the three human steps.
9. `https://vertuo-omni-loop-galaxy.vercel.app` keeps serving every page it serves today, with no
   redirect.
10. `pnpm test` is green.
