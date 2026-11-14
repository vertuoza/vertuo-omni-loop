# ADR-0128 — A settings page names its owners in an owner front-matter key, null meaning the law owners, left out of the laptop's copy

**Status:** adopted · **Date:** 2026-10-23 · **PRD:** #2417 · **Decided:** nobody — adopted when raised (medium), 2026-10-23 · **Merged:** @pierrederval, 2026-10-23, PR #2479

## Context

Whether the `owner:` line is a front-matter key of the settings page: a list of GitHub logins (a leading @ allowed), or `null` for the settings repository's `laws.owners`; a page without the line reads as `null`. The curated pages ship `owner: null`. The forms' parser (`kit/lib/playbook/forms.ts`) refuses unknown front-matter keys, so `readSettingsPage` in `kit/lib/omni-settings/page.ts` takes the line out of the front matter before the copy is written, the body kept byte for byte, and `ownersOf` falls back to the law owners. An owner line that names no login skips that page, named in the copy's record.

## Decision

Each settings page names its owners in an owner header key: GitHub logins, or null (or no line) for the settings repository's laws.owners. The page reader removes that key before writing the laptop's copy, keeping the body byte for byte.

The option chosen: A. A. An owner key in the page's header, a list of logins or null for the law owners, left out of the laptop's copy: the option built.

## Consequences

A constant: moving the line into the page body or into the forms' own schema is a change to one reader before any settings repository holds pages.

## Source

`.omni-loop/delivery/shipped/2417-tech-defaults/outbox/settled.md`, entry `s1-02-owner-line`
