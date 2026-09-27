---
id: s1-03-menu-link-without-galaxy
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Someone signed in whose page has no galaxy to show, because their account is outside the crew or the galaxy could not be read, follows the link to the game's menu. Where should they land?

## The decision, in plain words

The game starts from its intro, as its home address does, and then takes them where it always would: the screen for an account outside the crew, or the menu with the galaxy marked out of reach.

## The intro, for fun

The link promised a menu, but the galaxy had wandered off for the afternoon.

## The punchline, for fun

So the arcade starts from the top, and the intro walks them to the right door.

## The options, in plain words

A. Start from the intro, as the home address does, the option built.
B. Open the menu for the crew even with the galaxy out of reach, and the intro for an account outside the crew.
C. Open the menu for everyone signed in.

## What I had to decide

What a deep link opens for someone signed in whose page holds no galaxy: an account outside the crew, or a crew member whose galaxy is out of reach.

## What I did meanwhile

landing() in src/arcade/deep-link.ts returns nothing for a signed-in session without a galaxy, as readHash did before for every link, so the arcade starts at the boot. The door (allowed) cannot tell an account outside the crew, so opening the menu for them would show a menu they cannot use in place of their own screen.

## What it costs to change later

One condition in landing(); nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Acceptance criterion 9 says /#menu opens SELECT MODE for a signed-in person, without naming an account outside the crew or a galaxy out of reach.
