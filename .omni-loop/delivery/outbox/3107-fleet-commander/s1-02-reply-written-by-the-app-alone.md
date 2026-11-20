---
id: s1-02-reply-written-by-the-app-alone
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The spec says who may read the Commander's thread but not who writes its replies. Should a reply be saved by the app alone, or by the member who asked, under their own sign-in?

## The decision, in plain words

A member's question is saved under their own sign-in, signed with their name; the Commander's reply is saved by the app alone, so no member can ever write words the Commander signs.

## The intro, for fun

Anyone could sign the Commander's name, if the pen were left on the desk.

## The punchline, for fun

The pen now stays in the app's pocket.

## The options, in plain words

A. A. As built: the question under the member's sign-in, the reply by the app alone.
B. B. Both under the member's sign-in, through a function that accepts one reply per question from its asker.

## What I had to decide

A keeps the Commander's signature trustworthy: only the app, after its model call and its link filter, writes a reply, and the database refuses a reply from anyone signed in. B writes the reply under the asker's own sign-in, as the Ask classifier writes its guessed category (BR-PRODUCT-40), which needs no service key but lets a member write a reply by hand. Sources: L-AIACT-1, never#10, vertuo-omni-loop/BR-PRODUCT-40, the missions' events, written by the service role alone.

## What I did meanwhile

Replies are written with the service role key the missions already use; a deployment without it answers that the Commander is not available there.

## What it costs to change later

Switching to B is one database function and one line of the app's wiring; no stored reply changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A reply's links are also held by the database to the app's own pages and GitHub, whoever writes it. (author)
