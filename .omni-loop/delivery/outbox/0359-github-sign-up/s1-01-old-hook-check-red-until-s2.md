---
id: s1-01-old-hook-check-red-until-s2
prd: 359
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The older database check still expects the old rule that let people in by their company email, so it fails once GitHub becomes the only way in. Should this slice fix that older check, or leave it to the slice that removes the old rule?

## The decision, in plain words

This slice leaves the older check alone, since it belongs to the next slice's ground. Until that slice merges, the older check fails on the feature branch; the new sign-up check passes and runs first.

## The intro, for fun

The old doorman still checks email badges, but the door now only opens for GitHub.

## The punchline, for fun

He keeps shouting until the next slice hands him a new list.

## The options, in plain words

A. A: leave access.sql to s2; the supabase check is red on the feature branch until s2 merges (built)
B. B: widen s1's territory to delete access.sql's hook section now
C. C: reorder so s2's access.sql change lands with s1

## What I had to decide

Whether the older access check may stay red on the feature branch between this slice and s2.

## What I did meanwhile

supabase/checks/access.sql's hook section (the domain cases) fails against the new hook; s2, which owns access.sql, rewrites it. The signup.sql step was placed before the access step in the workflow so its proof shows.

## What it costs to change later

A constant: s2 deletes the old hook section of access.sql, or this slice could delete it in a one-line follow-up.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not say which slice updates access.sql's hook section; s2 owns the file (author)
