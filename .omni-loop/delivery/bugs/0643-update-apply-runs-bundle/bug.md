# Bug 643: omni update: the downloaded bundle hands back to the pinned bin, so an out-of-date repository never updates

## Triage

- **Domain:** the kit's install and update path (`kit/lib/launch/launch.mjs`, `kit/bin/commands/update.mjs`)
- **Risk:** high — every repository whose pinned bin is behind the release cannot update with `omni update`; it reports `nothing to commit` and loops, and copying the bundle by hand skips the config, forms and labels steps.
- **Regression:** yes — #421 (PRD 420) added the launcher, which hands every run inside a checkout to the pinned bin, including the `update --apply` hop #352 (PRD 347) relies on running as the downloaded bundle.

## Reproduction

- **File:** `kit/lib/launch/launch.test.mjs`
- **Red:** AssertionError: expected { kind: 'handover', …(1) } to deeply equal { kind: 'self' }

## Fix

`omni update` downloads the target release's bundle and runs it in the checkout as `update --apply`, but the launcher handed that run back to the repository's older pinned bin, which then installed its own version again. The launcher now lets `update --apply` run as the file that was started, so the downloaded bundle applies its own version; every other command still hands over to the pinned bin.

## Guard

A contract test in `kit/bin/update.test.mjs` takes the exact arguments `omni update` hands to the downloaded bundle and asserts the launcher, in that checkout with an older bin, lets the bundle run itself. It fails on `main`'s launcher and passes on the fix, so either side changing alone breaks it.

## Mutation

not set here
