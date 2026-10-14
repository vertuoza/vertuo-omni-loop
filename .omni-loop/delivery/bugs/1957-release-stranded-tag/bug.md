# Bug 1957: release fails forever when a release commit landed but its tag did not

## Triage

- **Domain:** the kit release (PRD 347): `kit/release/release.ts`
- **Risk:** medium — every merge into main gets a red release run and no version, tag or GitHub Release until someone tags the stranded commit by hand; production still deploys through release-fallback
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/release/release.test.ts`
- **Red:** AssertionError: expected 'git push origin v0.0.10' to be 'git checkout d38a9852d38a9852d38a9852…' // Object.is equality

## Fix

The release took its version from the tags only, so when the tag push of `v0.0.415` failed after its release commit reached main, every later run tried to cut `v0.0.415` again and failed with nothing to commit. Now, when main already holds the release commit of the version the tags give, the release tags that commit, pushes the tag, publishes its Release with the bundle that commit built, and then cuts the next version as usual.

## Guard

The reproduction is the guard: a unit test of a release commit whose tag never landed, the case no test covered.

## Mutation

mutation: no changed core file against origin/main (2e87cd9f): nothing to mutate
