---
id: s1-02-look-for-extends-default
prd: 2871
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

A repository may add its own things for the Reviewer to look for, and must never drop the kit's six. Where should the full list, the six plus the additions, be read from?

## The decision, in plain words

A new command prints the full list: the six first, then each item the repository adds, a repeat of one of the six dropped. The page that prints the playbook still shows the repository's own section in place of the six, as it does for every other section.

## The intro, for fun

Six things to look for, and every repository wants a seventh.

## The punchline, for fun

The seventh joins the line, and the six keep their place.

## The options, in plain words

A. A. A new review command prints the full list, and the playbook page shows the repository's section as written (built).
B. B. The playbook page itself prints the six, then the repository's additions, for this one section.

## What I had to decide

The spec says a repository's look-for section adds to the kit default and never removes from it, while `omni kb show` resolves every section by replacing the kit default with the repository's text (kit/lib/playbook/resolve.ts, outside s1's territory). s1 added `omni review look-for`, backed by kit/lib/review/look-for.ts: the kit default's list items, then the list items of the section the repository resolves to, a repeat dropped; prose around the items adds nothing. The curated settings page's look-for is prose naming the six, so it adds nothing. s2's skill should read `omni review look-for`.

Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

Built `omni review look-for` and left `omni kb show review` printing the repository's section in place of the default, labelled as every section is.

## What it costs to change later

A constant: making kb show merge the two instead is a change to the resolver for one slot, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person reading `omni kb show review` expects to see the six beside the repository's additions.
