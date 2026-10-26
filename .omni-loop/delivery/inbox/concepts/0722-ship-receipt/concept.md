---
concept: 722
title: Ship Receipt
kind: product
scale: vast
---

## The brief

Find what would have the most impact on **habit** (people come back on their own, daily) and
**adoption** (people actually run their work through it) of the Omni Loop and the Omni page, **for
Vertuoza's own teams**: developers, product managers and designers.

What the person said holds them back today: it is **heavy to start** (too many steps from an idea to
a first PRD and a first yolo), **nothing pulls them back** once a PRD ships, and **its value is not
visible** (people do not see what the loop gave them, so they fall back to their usual way). Working
from the terminal is not the problem.

Assumed, and not corrected: a healthy daily pull, never dark patterns; success is more people
starting a PRD each week, more of them opening the Omni page daily, and more of each team's work
going through the loop.

## The vision

**Every ship prints what it gave.** When the last pull request of a PRD merges, the loop prints a
**receipt**, on that pull request and on the PRD's page, built only from what is already recorded
(the spec, the plan, the outbox, the release note and git), never from made-up numbers.

Its wow moments:

- **The headline tells you what users get**, only when it was measured: "/prd loads 401 ms faster".
  A ship that measured nothing prints no headline at all, and nudges you to name one measure next
  time, which the next brainstorm asks for.
- **Your part and the loop's part, side by side**: 3 merges and 1 answer from you; 10 slices, 42
  test files and 14 decisions taken for you by the agents.
- **What didn't make it is on the receipt too**: "out of stock, not billed: first byte 386 ms, target
  200". Tear it off, and it becomes an idea for whoever set that target.
- **Returns, 30 days**: object to any decision the agents took for you, in one line. It opens a
  lite brainstorm, shows how long it has waited, and once fixed it greets you in the next morning's
  first `claude`.
- **A QR code on every receipt** opens the PRD's credits: the first opening plays them once, any key
  skips, never after hours, and they end on the receipt.
- **Your week in one line for stand-up, and the team's month for leads**, as team totals only
  ("measured on 3 of 9", "started a PRD: 5 people"). Nothing ranks people.

## Why this one

Crowned by the person in round 2, over Morning Line (M) and One Move to Building (O).

The panel's last scores on it, median of six (range): Wow 4 (4–5) · User value 4.5 (4–5) · Craft 5
(5–5) · Fit 5 (5–5) · Feasibility 4 (4–4).

| Role | Wow | User value | Craft | Fit | Feasibility | Stance |
|---|---|---|---|---|---|---|
| Visionary | 5 | 5 | 5 | 5 | 4 | The receipt now opens mid-print, never on an empty strip, and the decisions show once. It is still the page I'd screenshot. Build it first. |
| Craft | 4 | 4 | 5 | 5 | 4 | Build one receipt that renders the same in the PR comment, on the page and as the stand-up image, and design the screen for when CI fails to print it. |
| Skeptic | 4 | 4 | 5 | 5 | 4 | CI printing and returns going to brainstorm fix my concerns; the proof is one receipt built from files already shipped. |
| Value | 4 | 5 | 5 | 5 | 4 | The stub, the team count and tomorrow's line give the receipt the pull toward the next day that it lacked. |
| User (developer) | 4 | 5 | 5 | 5 | 4 | CI printing it on the PR reaches me where I actually merge, on GitHub from my phone. |
| User (product manager) | 4 | 4 | 5 | 5 | 4 | The receipts give me proof I can forward to my team, and returns give me a real say over the decisions agents took. |

**Dissent, kept.** The PM, Craft and the Skeptic hold User value at 4: "a receipt comes once per ship
and won't bring me back daily" (PM). The receipt proves the value; the daily pull and the easy start
live in the two directions not crowned (below).

**Watch-outs the areas carry.** `gh pr merge` prints nothing, so CI prints the receipt, with a "not
printed · retry" state. A return is a product decision, so it opens a lite brainstorm, never
/omni:bug-fix. The receipt never appears on the public /releases page (P-PRODUCT-29). The credits
use only game words the live rules support (P-PRODUCT-32).

## Killed and why

- **B · Night Ghost** (round 1): rebuild hand-made work overnight and hand over the tests you missed. Killed by the person; its side-by-side clock read as a stopwatch on people, and its own times did not add up.
- **F · Dawn Transmission** (round 1): OmniMan's morning radio. Merged into A; its voice survives as one line of copy.
- **G · Terraform Credits** (round 1): end credits with the real record. Merged into D; it lives on as the credits the QR code opens.
- **A · Mid-Sentence** and **H · Co-op Room** (round 2, folded into M · Morning Line): the first minute of the day with the question dealt to you, yesterday's kept line, and a stand-up room for what's left. Not crowned; Fit 5 from all six, Feasibility 3 (a start hook only prints; owners need authorship brainstorm does not record yet). Its tomorrow line survives in the returns area.
- **C · Mise en Place** and **E · One Coin** (round 2, folded into O · One Move to Building): a kit or one line becomes a live preview before lunch, with a STOP button and one question up front. Not crowned; Wow and User value 5 from all six, Feasibility 2 (the live preview does not exist yet, and moving the phase-0 read needs its own PRD). The stub's kits are the seed of its box.

## Fuel

Today's product, read from the repository: 69 shipped PRDs, each with a release note; 65 settled
outboxes where 519 decisions were adopted by agents ("Approved by: nobody"), 21 agreed and 1
drifted, nearly every human approval by one person; 2 to 4 merges per PRD and 7 onboarding steps
before a first one; the Omni page (HOME, the arcade, the personal dashboard, dossiers, ask, releases)
in the Omni theme (void ground, cab surfaces, yellow signal, pixel type); a game layer mostly dormant;
principles P-PRODUCT-3, 12, 15, 24, 27, 29, 30, 32, 38, 45, 46 and alerts opt-in by default.

World-class references. The session's proxy let pages be opened in full only on github.com, so each
reference below was seen through its search result, except the one marked opened:

- Duolingo gradual engagement — https://www.appcues.com/blog/gradual-engagement-mobile-app-first-screen — a first win before any setup.
- Stripe docs with your own test keys — https://www.moesif.com/blog/best-practices/api-product-management/the-stripe-developer-experience-and-docs-teardown/ — the first step arrives personalised.
- Endowed progress — https://learningloop.io/plays/psychology/endowed-progress-effect — count real prior work as progress.
- Fogg Behavior Model — https://www.behaviormodel.org/ — shrink the action, anchor it to an existing moment.
- Hook model, investment — https://amplitude.com/blog/the-hook-model — the end of one cycle loads the next.
- Hemingway bridge — https://www.todoist.com/productivity-methods/hemingway-bridge — stop with a concrete next step.
- Hades meta-progression — https://www.thegamer.com/hades-mirror-of-night-roguelite-progression/ — no run is wasted.
- Wordle — https://webflow.com/blog/wordle-design — a daily ritual and a spoiler-free shareable result.
- Strava kudos — https://www.sciencedirect.com/science/article/pii/S0378873322000909 — cheap peer acknowledgment.
- Streak forgiveness — https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/ — rest is never punished.
- Spotify Wrapped / Grammarly Insights — https://nogood.io/blog/spotify-wrapped-marketing-strategy/ — usage told as a story starring the user.
- Basecamp Hill Charts — https://basecamp.com/hill-charts — show uncertainty, not tasks.
- Vercel preview comments — https://vercel.com/blog/introducing-commenting-on-preview-deployments — a live link anyone can comment on.
- The Power of Small Wins — https://hbr.org/2011/05/the-power-of-small-wins — progress is the strongest daily motivator.
- GitHub removed contribution streaks (opened) — https://github.com/isaacs/github/issues/627 — per-person streaks punish rest.
- Game design, not gamification — https://blog.superhuman.com/game-design-not-gamification/ — rewards undermine intrinsic motivation.

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| receipt-at-merge | The receipt at the last merge | CI prints the receipt as a PR comment and a Receipt tab on the PRD's page, only from the spec, plan, outbox, release note and git; the headline shows only when measured, a receipt with no measure has none and a nudge, a "not printed · retry" state, never on the public releases page. | |
| spec-measure | One named measure per spec | /omni:brainstorm asks for one measure and writes it into the spec, so later receipts have a headline to print. | |
| receipt-returns | Returns, 30 days, and tomorrow's line | One line against one decision taken for you opens a lite brainstorm; the receipt shows how long a return has waited; a fixed return prints one line in the next day's first claude. | |
| team-receipt | Your week, the team's month | A stand-up line built from your own receipts, copied as a small receipt image, and a monthly team receipt with team totals only ("measured on 3 of 9", "started a PRD: 5 people"); nothing ranks people. | |
| receipt-stub | The stub | T tears off the out-of-stock line into an idea addressed to whoever set the missed target, a kit once a weekly box exists; u undoes for 10 s. | |
| credits-qr | The credits, by QR code | Every receipt ends with a QR code, measured or not, that opens the PRD's credits page; the first opening plays the credits once, any key skips, never after hours, they end on the receipt, only game words the live rules support. | |
