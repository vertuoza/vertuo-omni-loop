---
id: s1-03-ci-form-evidence-line-dropped
prd: 1814
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

Deleting the old Claude-only check left the CI page of the playbook pointing at a missing file, which turns the checks red. Is it fine that this slice dropped that one pointer, though the page belongs to a later slice?

## The decision, in plain words

The one pointer to the deleted file was removed from the CI page, so the repository's checks stay green. The page's wording about the old check is left for the later slice that rewrites it.

## The intro, for fun

One signpost still pointed at a house that was just knocked down.

## The punchline, for fun

We took the signpost down and left the map redraw to the cartographer.

## The options, in plain words

A. A. This slice drops the one pointer, and the later slice rewrites the page.
B. B. The pointer stays, and the checks are red until the later slice lands.

## What I had to decide

Keep A: s3 rewrites the CI form's paragraph on the old hook and can add the git hooks as evidence then. B would leave omni check all red on the feature branch until s3 merges.

## What I did meanwhile

The ci form's evidence list no longer names .claude/hooks/fallow-gate.sh; its paragraph on the Claude session's fallow audit still describes the old hook until s3.

## What it costs to change later

Cheap: one evidence line, which s3 rewrites anyway.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The ci form is s3's territory; this is the only line of it s1 touched (author)
