---
id: s10-01-prd-page-github-part-not-live
prd: 657
slice: s10
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The PRD page now reloads itself only when a new version or a new question round appears. Should a new stage, a changed outbox count, an answer typed on GitHub, or an answer given in another tab still show without reloading the page?

## The decision, in plain words

They no longer show on their own: the page stops asking for them and shows them the next time it is opened or reloaded. New versions and new rounds still appear within seconds.

## The intro, for fun

The page used to twitch at every whisper from GitHub; now it waits for real news.

## The punchline, for fun

Quieter page, but a reply typed on GitHub waits for the next reload.

## The options, in plain words

A. Refresh only on a new version or a new round; stage, outbox count and outside answers show at the next load (built)
B. Keep A, and add a small live stage and outbox badge that re-reads that part on its own every 15 seconds
C. Also refresh the whole page when an answer lands, as before

## What I had to decide

Whether the stage, the outbox count and answers typed elsewhere must still appear live on an open PRD page.

## What I did meanwhile

They show at the next load of the page; new versions and new rounds still appear within about 2 seconds.

## What it costs to change later

Option B is one small component that re-reads the stage and outbox part through the existing server call, without re-rendering the whole page. Option C is a one-line change back in the page's watcher.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the GitHub pill refreshes on its own through its existing server action, but no such pill refresh exists today; the server call it would use is left in place, now unused (author)
- Whether an answered count moving without a new round should refresh was not settled by the spec; read strictly, it does not (author)
