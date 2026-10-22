# Bug 2400: the knowledge harvest fails once the delivery history passes 20 MB

## Triage

- **Domain:** Omni App · knowledge harvest
- **Risk:** medium — every merged PRD of this repository gets no knowledge PR, so settled decisions are not written back to the knowledge base; workaround: `omni harvest <prd> --pr <n>` run by hand
- **Regression:** yes — the code did not change, the data grew past the bound: the last harvest that worked opened #2142 on 2026-10-17; it failed on #2307, #2316, #2339 and #2348

## Reproduction

- **File:** `apps/omni-app/src/knowledge-harvest/knowledge-harvest-bound.test.ts`
- **Level:** unit
- **Red:** SnapshotBoundError: The snapshot holds 20,981,975 bytes, over the bound of 20 MB.

## Fix

The harvest snapshotted the whole delivery folder, every PRD the repository ever shipped, and the
snapshot refuses more than 20 MB. It now fetches only the merged PRD's own folders (inbox, outbox and
shipped); every other delivery file is listed and written empty, never fetched nor counted, as the
outbox check already does for a pull request's own folder (#1968).

## Guard

The reproduction: a delivery history past the bound in the harvest's own tests, which fails if the
harvest fetches another PRD's folder again; `harvest-scope.test.ts` pins which folders are fetched.

## Mutation

mutation: no changed core file against origin/main (5fefc9eb): nothing to mutate
