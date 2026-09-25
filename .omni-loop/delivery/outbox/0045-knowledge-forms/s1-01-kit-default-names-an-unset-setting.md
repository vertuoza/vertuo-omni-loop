---
id: s1-01-kit-default-names-an-unset-setting
prd: 45
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a shared default page names a repository setting that is empty or holds a list, what should the page show?

## The decision, in plain words

It shows the placeholder exactly as written and reports it, the same as a setting that does not exist, so a reader never sees a guessed value.

## The options, in plain words

A. A setting that is empty, or holds more than one value, stays as a visible placeholder and is reported, like an unknown one.
B. An empty setting prints as not set, and a list prints its values separated by commas.
C. An empty setting or a list prints nothing, and is reported.

## What I had to decide

The spec says a kit default may name a config value as `{config:<key>}`, filled from the repository's config, and that an unknown key is left visible and reported. It does not say what to print when the key exists but holds `null` (the default for `commands.test` and `commands.preflight`, so in most freshly installed repositories), a list (`commands.checks`, `paths.context`) or a whole section. The templates (s2) are written against this rule, and `omni kb show` (s3) prints its result.

## What I did meanwhile

`fillConfig` in `kit/lib/playbook/resolve.mjs` fills a string, a number or a boolean. A key that names nothing, a key set to `null`, and a key holding a list or a section are all left in the text as written, and each is reported as a problem line (`names no config key`, `is not set in the config`, `holds no single value`). Tests: the `fillConfig` cases in `kit/lib/playbook/resolve.test.mjs`.

## What it costs to change later

A constant: widening `configValue` in `kit/lib/playbook/resolve.mjs` (for example, joining a list with commas) is a few lines and a test, before or after merge; no stored data or repository file depends on it. A template that already names a list key would start printing it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any kit default will need a list setting, such as the extra checks, printed inline: the templates are not written yet (s2).
