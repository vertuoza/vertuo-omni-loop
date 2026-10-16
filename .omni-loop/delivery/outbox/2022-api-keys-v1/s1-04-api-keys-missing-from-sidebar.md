---
id: s1-04-api-keys-missing-from-sidebar
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The new API keys page has its tab under Settings, but the side menu's Settings list still shows only the five older pages. Should the side menu list API keys too?

## The decision, in plain words

We added the tab the plan asked for and left the side menu as it is, because the menu lies outside the ground this slice was given; the page is still reached from the Settings tabs.

## The intro, for fun

The new room has a door, just not a sign in the hallway.

## The punchline, for fun

People who open Settings will still find it on the tabs.

## The options, in plain words

A. Leave the side menu as it is, the page reached from the Settings tabs (built).
B. Add API keys to the side menu's Settings list in a follow-up change.

## What I had to decide

Whether the sidebar's Settings entry (apps/galaxy/src/nav/sidebar.ts, with its tests and switch.test.ts) lists Settings › API keys beside the tab added to SETTINGS_TABS.

## What I did meanwhile

Only the Settings tabs name API keys; the menu's Settings list keeps Fleets, Repositories, Business, Products and Jev.

## What it costs to change later

One entry in sidebar.ts and three test lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the menu should list every Settings tab, or only some (author)
