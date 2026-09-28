---
id: s3-01-rest-of-home-still-says-one-folder
prd: 324
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The front page now says, where it explains adopting and leaving the loop, that setting it up adds a status line too. Should the two other places on that page that still promise one folder only, and the app guide that sums up that section, change as well?

## The decision, in plain words

Only the section on adopting and leaving changed, as the brief asks. The banner's promise of one folder in and one folder out, the card promising heads of engineering one folder to adopt, and the guide's summary of the section are left as they were.

## The intro, for fun

The page learned a new line in one spot, and still hums the old tune in two others.

## The punchline, for fun

One section sings the new verse, while the chorus waits for a person to pick its words.

## The options, in plain words

A. Leave the banner's promise, the card's proof and the guide's summary as they are: only the section on adopting and leaving names the status line. The option built.
B. Bring the guide's summary of the section in line with the page, and keep the banner's promise and the card's proof, read as the loop's one folder in spirit.
C. Bring the guide's summary in line, and reword the banner's promise and the card's proof too, so nothing on the page promises one folder only.

## What I had to decide

Whether HOME's other one-folder claims change with the "Easy in, easy out" spread: the poster's promise strip `ONE FOLDER IN, ONE FOLDER OUT` (`apps/galaxy/src/home/poster/Poster.tsx`, asserted in `apps/galaxy/src/home/home.test.ts`), the HEAD OF ENGINEERING proof `One folder to adopt; delete it to stop.` (`apps/galaxy/src/home/spreads/ForYou.tsx`), and the HOME section of `apps/galaxy/README.md`, whose item 5 still sums the spread up as "GET OUT: delete `.omni-loop/` and commit". The spec's D3 says the one-folder promise is no longer true and HOME must not say it is; its Scope puts "HOME outside the Easy in, easy out spread" out; and the plan's s3 territory holds only the spread and `.claude/settings.json`.

## What I did meanwhile

Only the spread changed: GET IN's first step and GET OUT's bold line read exactly as the spec's HOME section words them, each path and the `statusLine` key in `<code>`, asserted in `InOut.test.ts`, with `lingo.test.ts` green. The promise strip, the For-you proof and the README's summary line are untouched, and still say one folder.

## What it costs to change later

Copy only: one string in `Poster.tsx` with its assertions in `home.test.ts` (and the README's description of the promise strip), one proof in `ForYou.tsx` with `ForYou.test.ts`, and one line of `apps/galaxy/README.md`. No stored data, and no other slice depends on it. Any rewording must keep `lingo.test.ts` green.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's D3 (HOME must not say the one-folder promise) and its Scope (HOME outside the spread is out) disagree on the promise strip and the For-you proof; nothing says which one wins.
- (author) `apps/galaxy/README.md` is outside s3's territory, so its summary of the spread could not be brought in line in this slice.
