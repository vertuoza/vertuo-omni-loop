---
id: s4-02-service-role-cannot-renumber
prd: 262
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The publishing step is the only writer of the public release list. Should the database let it change a release's number or date, or delete a release, or only add releases and fix their wording?

## The decision, in plain words

It may only add releases and fix their title and description. A version or a date, once published, cannot be changed by it, and removing a release stays a person's job in the database console.

## The intro, for fun

A version number is a promise to the outside world, so the question is who gets a pen that can rewrite it.

## The punchline, for fun

The robot may fix typos, but the numbers are carved in stone and it did not bring a chisel.

## The options, in plain words

A. The service role adds releases and retitles them only; a person renumbers, redates or removes one in the database console: the option built.
B. The service role may also update every column and delete rows, and only the sync's own code keeps its promises.

## What I had to decide

Which writes the migration grants the service role on `public.releases`. The spec says nobody but the service role writes, the sync keeps a row's `release` and `released_at` forever and never deletes a row, and removing a release is a person's decision made in the database; it does not say whether the database itself should hold the service role to that.

## What I did meanwhile

`supabase/migrations/20260929090000_releases.sql` grants the service role `select` and `insert`, and `update` on `title` and `description` only, with no `delete`. `supabase/checks/releases.sql` proves it may add and retitle, and is refused a renumber, a redate and a delete. The sync (`sync-table.ts`) inserts new rows and updates only those two columns, so it needs nothing more.

## What it costs to change later

One follow-up migration granting more (`update` on every column, or `delete`) and the matching lines of the check. No row changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether anyone expects another tool running as the service role, rather than a person in the database console, to correct a wrong version or date or remove a release.
