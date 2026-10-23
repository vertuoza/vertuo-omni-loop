---
id: s1-02-owner-line
prd: 2417
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Where does a shared rules page say who approves a change to it, and what does it say when nobody was named?

## The decision, in plain words

Each page names its owners in its header; a page that names nobody belongs to the people who already own the repository's laws. The copy a laptop reads leaves that line out, since only the settings page needs it.

## The intro, for fun

Every rulebook page wants a name on the door, even if the door says 'ask the usual people'.

## The punchline, for fun

The usual people got the keys; the laptop just gets the rules.

## The options, in plain words

A. A. An owner key in the page's header, a list of logins or null for the law owners, left out of the laptop's copy: the option built.
B. B. The same key, taught to the forms' own parser, so every playbook page of every repository may name an owner.
C. C. A visible owner line in the page's text, under its title, read by the settings pages only.

## What I had to decide

Whether the `owner:` line is a front-matter key of the settings page: a list of GitHub logins (a leading @ allowed), or `null` for the settings repository's `laws.owners`; a page without the line reads as `null`. The curated pages ship `owner: null`. The forms' parser (`kit/lib/playbook/forms.ts`) refuses unknown front-matter keys, so `readSettingsPage` in `kit/lib/omni-settings/page.ts` takes the line out of the front matter before the copy is written, the body kept byte for byte, and `ownersOf` falls back to the law owners. An owner line that names no login skips that page, named in the copy's record.

## What I did meanwhile

Nothing reads the owners yet but the page reader; s7 (the edit on the Omni page) is the first slice that will.

## What it costs to change later

A constant: moving the line into the page body or into the forms' own schema is a change to one reader before any settings repository holds pages.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's Q3 says an owner line defaulting to the law owners, and does not say where on the page it sits or whose law owners: the settings repository's, which is the repository the page lives in, is the option built.
- (author) Whether a page with no owner line should be refused rather than read as the law owners' is not settled; it is read, the more lenient choice.
