# Bug 571: omni reads 1e2 or 0x10 as a PRD number instead of refusing it

## Triage

- **Domain:** the omni command line — how every command reads a number it is given (a PRD, an issue, a pull request)
- **Risk:** low — a person who types a number in an odd form gets a different PRD than the one they meant, with no warning; the workaround is to type the number in plain digits
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/args.test.mjs`
- **Red:** × omni prd "0x10" is refused, not read as another PRD — AssertionError: expected '' to be 'omni prd: <n> must be a positive numb…' // Object.is equality

## Fix

Every command read its numbers through JavaScript's `Number()`, which also accepts exponents, hex, octal
and binary prefixes, a sign and surrounding spaces, so `omni prd 0x10` looked up PRD 16 and `omni prd 1e2`
printed PRD 100. `positiveInt` in `kit/bin/args.mjs` now accepts plain digits only and refuses anything
else with the usual "must be a positive number" line; the bundle is rebuilt.

## Guard

A unit test of `positiveInt` in `kit/bin/args.test.mjs` feeds it ten non-digit forms (hex, octal, binary,
exponent, fraction, sign, spaces, a newline, an underscore, Infinity); it fails on the default branch's
reader and passes on the fix, so any return to a looser reader is caught for every command at once.

## Mutation

not set here
