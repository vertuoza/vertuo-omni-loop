---
id: s6-02-kit-default-in-deployment
prd: 2417
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

Will the kit's first default pages be present on the deployed Omni page, which reads them from files shipped with the kit?

## The decision, in plain words

The page reads the kit's first default from the kit's template files and, when they are not in the deployment, shows only the settings repository's own pages and logs why.

## The intro, for fun

The house rules are printed in a book that may not have been packed for the trip.

## The punchline, for fun

If the book is missing, the page shows what the repository wrote and says nothing rude about it.

## The options, in plain words

A. A. Fall back to the settings repository's pages alone, logging the failure (built).
B. B. Tell the app's build to ship the kit's first default files, in a later change.
C. C. Embed the first default's text in the Omni page's own code.

## What I had to decide

Whether the app's file tracing (apps/galaxy/next.config.ts outputFileTracingIncludes, outside this slice's territory) should include kit/templates/omni-settings so a deployment carries the kit's first default.

## What I did meanwhile

A failed read of the templates is caught in omni-settings-pages-live.ts and logged; the list then holds only the settings repository's pages.

## What it costs to change later

On a deployment without the templates, a page the settings repository lacks is not listed at all instead of marked as the kit's default.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Vercel build already traces kit/templates (author)
