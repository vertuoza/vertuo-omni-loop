---
id: s2-01-sign-in-joins-workspace
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Someone opening a PRD link for the first time may not belong to its workspace yet, because they have never signed in to the galaxy. Should signing in from the PRD's page also make them a member, as signing in from the game does?

## The decision, in plain words

Yes. Signing in from a PRD's page adds the person to the workspace of their company email, as signing in from the game already does, before the page is shown to them.

## The intro, for fun

A product owner followed a link from a chat and knocked on a door that had never heard of them.

## The punchline, for fun

Now the door checks their company badge first, then opens.

## The options, in plain words

A. Join the person's workspaces when they sign in from the PRD page, as the game's sign-in does
B. Join nobody there: a first-time visitor gets not found until they open the game once
C. Join on every visit to the page, not only at sign-in

## What I had to decide

Join the person to the workspaces of their email domain when they sign in from the PRD page, or leave joining to the other pages and show not found until they have visited one.

## What I did meanwhile

The PRD page's sign-in return joins the person to the workspaces of their confirmed email domain, as the arcade's sign-in does. A failure to join is logged, and the page then says not found.

## What it costs to change later

One call in the page's sign-in return; removing it changes nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the pages sign in like the ask pages, whose own sign-in returns do not join; whether they leave joining out on purpose is not written anywhere.
