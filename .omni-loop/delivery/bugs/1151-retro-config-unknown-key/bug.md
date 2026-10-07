# Bug 1151: the retro and knowledge harvest skip in silence when the config has a key the App does not know yet

## Triage

- **Domain:** the GitHub App's retro and knowledge harvest: `qualify` reads the config at the merge commit (`apps/omni-app/src/retro/qualify.ts`)
- **Risk:** medium — every PR that adds a config key loses its retro and knowledge PR without a word when its merge is handled by the App build still live before the deploy; the workaround is replaying the merge event in Inngest (Jev, 0.90)
- **Regression:** new bug — no evidence this ever worked: the schema has been strict and the skip silent since PRD 72; #1140 (`generated`) is the first case confirmed

## Reproduction

- **File:** `apps/omni-app/src/retro/qualify.test.ts`
- **Red:** Error: skipped: .omni-loop/config.yml is not a valid Omni Loop config: branches: Unrecognized key(s) in object: 'later' (unrecognized: later)

## Fix

The kit's strict config reader refused the whole file over a key the deployed App did not know yet, and `qualify` turned that refusal into a silent skip, for the retro and the knowledge harvest alike. `parseConfig` gains `ignoreUnknownKeys`, which leaves out keys it does not know, at any depth, and still refuses a wrong value; `readBaseConfig` passes it through and only `qualify` asks for it, so the outbox and inbox checks keep refusing a typo. A config that still cannot be read now throws, so the retro's failure handler posts "The retro could not run" on the merged PR instead of nothing.

## Guard

`kit/lib/config.test.ts` pins both readers: strict by default (an unknown key is refused, naming it), lenient with `ignoreUnknownKeys` (top-level and nested unknown keys left out, a wrong value still refused). It fails on the default branch's `parseConfig` and passes on this branch.

## Mutation

not run — Stryker's typescript checker failed its dry run: packages/github/src/client.ts(189,57): error TS2769: No overload matches this call.
