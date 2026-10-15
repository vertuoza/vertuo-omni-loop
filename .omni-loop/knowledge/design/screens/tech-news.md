---
screen: tech-news
status: draft
kind: page
mock: tech-news.html
implements: []
reads: []
routes: []
supersedes: null
---

## Purpose

Products › <product> › Tech News: the week's edition of a product's launches added to Friday. At
11:00 on Friday it sends itself to Slack #release-won as one group video in the product's brand (a
cover, a 10–15 s chapter per feature in its own presentation, an outro). Nobody writes, cuts or
sends anything; each PM only ticks `Add to Friday` on their PRD's Launch tab (`launch`). The
message it sends (the group video with one line per feature and its chapter time) is a Slack
screen, not an Omni one, and is not drafted here.

## Regions

- **The head:** the breadcrumb `Products › <product> › Tech News`, the title `Tech News · Week <n>`,
  and `See it in #release-won` as the one primary. The facts: Friday (the clock and the date),
  Status (`Sends at 11:00`), Length, Chapters.
- **Added to Friday** (`Ticked by each PM`): one row per launch, each a tick its PM can untick, a
  still, the launch's headline, its PM, its cut (`Feature cut`, `Flash cut`, `From screenshots`),
  whether it already posted (`Posted Thu`) or is `Friday only`, and its chapter time.
- **Cover:** the edition's cover still, and three rules: `Never holds a launch back.`,
  `Under two: no edition.`, `No video: no edition.`

## States

- **Before Friday 11:00:** `Sends at 11:00`.
- **Sending**, then **Sent to #release-won**.
- **A row unticked:** the launch is left out of the edition, its row dimmed.
- **Skipped:** under two launches, there is no edition.
- **Group video failed:** the edition does not post.

## Words

Products · Tech News · Week · See it in #release-won · Friday · Status · Sends at 11:00 · Sending… ·
Sent to #release-won · Length · Chapters · Added to Friday · Ticked by each PM · Feature cut ·
Flash cut · From screenshots · Posted · Friday only · Cover · Never holds a launch back. ·
Under two: no edition. · No video: no edition.

## Refusals

- It never holds back a launch set to `Post when shipped`.
- No video, no edition: a failed group video posts nothing, not even the lines alone.
- The product's own theme only; plain, with no blueprint or show costume.
- Only launches whose PM ticked `Add to Friday` go in.

## Open questions

- Its route: the concept fixes the place (Products › <product> › Tech News), not the URL.
- What a skipped week says, and whether a launch set to Friday only waits for the next edition or
  posts alone; how a Friday-only launch in a week under two is announced is not settled.
- When the edition is cut before 11:00 (the Skeptic's Thursday 18:00, Value's "before the Thursday
  cut"), and until when a PM can untick.
- Whether the automatic send counts as each PM's approval, given "nothing posts without the PM".
- Whether "Example" chapters can exist: the vision tour invents chapters 2 to 4 and tags them; the
  F-E developer doubts any chapter drawn as a mock is honest.
- Whether the owner of the product, besides each PM, can untick a launch.
- Whether there are enough opted-in launches per week to make an edition (the Skeptic's question).
- Does Slack play the uploaded group video inline and muted? Unproven, as for `launch`.
- Where the page is reached from: no entry on the products page or in the app shell is drawn.

## Source

/omni:think-big, concept #2024, crowned L on 2026-10-15: .omni-loop/delivery/inbox/concepts/2024-launch/vision.html
