# Bug 3315: the before/after page's diagrams are not drawn in a repository without Playwright

## Triage

- **Domain:** kit — the before/after page's diagrams (`omni before-after render`)
- **Risk:** medium — every PRD written in a repository without Playwright shows its Technical diagrams as raw source and asks the reader to install Playwright; the spec text stays readable
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/before-after/render-fetch.test.ts`
- **Level:** unit
- **Red:** `Error: Playwright is not installed in this repository`

## Fix

`omni before-after render` drew diagrams only with a Playwright installed in the repository, so a repository without one (a PHP back-end, for one) got the source and an install line nobody reading the PRD could act on. It now fetches a pinned Playwright (1.56.1) once into `~/.cache/omni`, never into the repository, installs its Chromium through Playwright's own CLI when it is missing, and says why when the fetch fails, with no install line.

## Guard

`kit/lib/before-after/render-fetch.test.ts`: a repository without Playwright must still get a browser, from the kit's cache, fetched once; red on `main`, green here.

## Mutation

mutation: no changed core file against origin/main (2b070e19): nothing to mutate

## Still open

- A page already written with a diagram left as source in a `<details>` is not redrawn by `omni before-after render`, which only finds `<pre class="mermaid">`: the page's author must put the source back in a `<pre class="mermaid">` and render again.
