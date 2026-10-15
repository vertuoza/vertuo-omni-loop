# The Anti-Loop — the studio's debate

Concept #1964. Every post by round, turn and role, dissent included. The studio: four concept artists (lenses: 10×, steal from another industry, delight, contrarian), then prototypers. The panel: the Visionary, Craft, the Skeptic, Value and five personas (F-E Developer, B-E DEv, Paul - Product Manager, Lead Engineer, Irisa). The moderator never voted.


Brief: see fuel.md › brief. Kind: product. Scale: vast. Personas: F-E Developer, B-E DEv, Paul - Product Manager, Lead Engineer, Irisa.

## Round 1 — concepts

Lenses: a1 10×, a2 steal from another industry, a3 delight, a4 contrarian.

- **a1-1 HINDSIGHT FORGE** — wow: the cause behind two retros (1322, 1628) becomes one guard, replayed against all 171 shipped PRDs: it would have caught 9. Axis: the past as the guard's test suite; whole history, output = guards proven on history.
- **a1-2 AS-BUILT** — wow: it reads main and writes the spec we actually shipped for 1904, laid over the promised one: every claim met, one file nobody asked for, one law quietly contradicted. Axis: code → spec, three-way diff (spec / code / KB), per claim.
- **a2-1 BLACK BOX** — wow: rewinds PRD 1628's flight recorder to the 3rd red `checks`, issues an NTSB-style safety recommendation (a guard) addressed to the playbook, "same crash as 1322". Axis: one PRD investigated back through time; output a recommendation to whoever can act.
- **a2-2 THE DIG** — wow: each night it cuts a trench through the repo, one layer per PRD, showing the layer that buried a KB sentence or left unclaimed code, fix ready. Axis: whole repo as space (strata), continuous; Q1 + Q4.
- ~~a3-1 REWIND TAPE~~ — sent back by the moderator: same direction as a2-1 (single-PRD timeline, freeze on red, guard); rewritten as:
- **a3-1 THE OATH DECK** — wow: every law and form line is a card that ages; the line I wrote months ago showed up cracked because its cited code moved on, and mending it was one click plus a person's seal. Axis: rewinds the knowledge base itself; states shining / cracked / unsworn / unseen; delight of tending a collection.
- **a3-2 ENTROPY HUNT** — wow: the sweep sees 1322 and 1628 died of the same drift, turns it into a boss haunting both planets; the fleet kills it with one guard. Axis: recurrence across PRDs as game enemies with bounties, shared by the fleet.
- **a4-1 THE REAPER PR** — wow: no report; it opened a PR deleting 418 lines, fixing a stale rule, adding the guard, every hunk citing its red or review. Axis: output is only a diff.
- **a4-2 THE GHOST CHECK** — wow: before CI ran, a check on my PR argued with the agent: 1322 and 1628 went red this exact way; the agent conceded. Axis: runs before shipping, argues instead of reporting.

Letters: A = a1-1 Hindsight Forge · B = a1-2 As-Built · C = a2-1 Black Box · D = a2-2 The Dig · E = a3-1 The Oath Deck · F = a3-2 Entropy Hunt · G = a4-1 The Reaper PR · H = a4-2 The Ghost Check

## Round 1 — debate

Moderator note: a3-1 Rewind Tape was sent back as a shade of C; word-pass findings returned to each artist and fixed; two on-purpose findings kept on E (law text, form line under check).

### Turn 1 (open)

#### visionary

My test for every card: would someone screenshot this and send it to a colleague?

### A Hindsight Forge
Reaction: "9/171 PRDs it would have caught" is the most screenshot-worthy number in the round. It turns the 161 shipped PRDs with no retro from a gap into a test suite, and it ties 1322 and 1628 together, which nothing does today. It answers Q2 well and Q3 in part. The risk is that it becomes a back-office batch job nobody sees.
Remix: *yes, and* every finding the anti-loop proposes, whether guard, KB fix or deletion, carries its replay receipt: "red on 1628 at s1, green on main, 0 false alarms across 171". Replay review threads as well as reds: "this rule would have answered 4 of the 6 human threads on 1322".
Scores: Wow 5 · Value 5 · Craft 4 · Fit 4
Stance: carry it, as the **proof engine** behind whatever ships, not as a screen of its own.

### B As-Built
Reaction: a promised spec next to the shipped spec, claim by claim, is the cleanest answer to Q4 and a strong answer to Q1 that I have seen. "12/12 claims met · 1 nobody asked · 1 law drifted" fits in a tweet. It lives on the PRD page, which is where people already look.
Remix: *yes, and* the As-Built does not freeze at merge. The nightly sweep re-reads it, so you watch a shipped PRD's claims decay as later PRDs build over them ("AC5 met at merge, broken by 1911 s3"). It replaces the empty **Retro** tab on `prd-dossier`.
Scores: Wow 4 · Value 5 · Craft 4 · Fit 5
Stance: carry it, as the **per-PRD face**: the body of the rewind.

### C Black Box
Reaction: the NTSB grammar (probable cause, safety recommendation, addressee, prior incidents) is the best output language in the round. Take that away, though, and the concept is today's retro with better typography: one PRD, one red, one guard. I would not screenshot the timeline.
Remix: *yes, and* make "Safety Recommendation 1628-R1, to: playbook › ci form, seen before: 1322" the format of every finding in the merged concept. Each one gets an addressee and a stable ID (P-PRODUCT-16 already requires one identity per finding).
Scores: Wow 3 · Value 4 · Craft 4 · Fit 4
Stance: fold its grammar in; drop it as a concept.

### D The Dig
Reaction: strata are a gorgeous metaphor, and "the layer that buried this sentence" is real attribution: which PRD made a KB line false. But a trench diagram is something you admire, not something you act on, and the find itself ("59 weathered") is the `kb status` number in costume.
Remix: *yes, and* keep only the attribution. Every drift finding names the PRD layer that caused it, and the deletion or KB fix PR is assigned to that PRD's thread.
Scores: Wow 4 · Value 3 · Craft 3 · Fit 3
Stance: take the "which layer buried it" idea and drop the trench.

### E The Oath Deck
Reaction: the best treatment of Q1 in the room. "Cracked, but I checked the code and it's still true, only the evidence is old" is the distinction `kb status` can't make today, and shining / cracked / unsworn / unseen is a vocabulary people would use. It is also the only concept that makes the *continuous* sweep feel alive instead of a cron log.
Remix: *yes, and* a card cracks the moment a merge moves the code it cites (per PRD), the nightly sweep re-tests the cracked ones (continuous), and the seal is a person's lock, never the agent's. Draw it on `star-chart` for the crew and on `/knowledge` for the desk.
Scores: Wow 4 · Value 4 · Craft 4 · Fit 5
Stance: strong runner-up. It is the **continuous surface** for the KB, and its states should feed the merge.

### F Entropy Hunt
Reaction: a boss that haunts two planets is fun, and recurrence-as-enemy is the right *idea*. But the skeptical F-E and B-E devs would call it fluff on sight, and the actionable part (one guard) sits under XP chrome.
Remix: *yes, and* skip the boss screen. Add two new wound kinds the game already lacks, `recurrence` (same cause on ≥ 2 planets) and `dead-weight` (code no claim needs), and pay bounty XP when a rewind PR merges. The game becomes the reward feed, not the front door.
Scores: Wow 4 · Value 3 · Craft 3 · Fit 3
Stance: drop it as a concept; feed its wounds and bounties into the game layer of the merge.

### G The Reaper PR
Reaction: this is the one I would screenshot first: "It never sent me a report. It opened a PR: −418 +37, and every hunk said which red or review it came from." It is the most radical reading of the success criterion "every finding ends in an action", where the action *is* the artifact. It answers all four questions in one diff.
Remix: *yes, and* the PR body is B's As-Built overlay, each hunk's check is A's replay receipt, and "drop a file to reject it; the rewind remembers why" closes the loop: a rejected hunk becomes a "deliberate" line in the KB, so the next sweep never proposes it again.
Scores: Wow 5 · Value 5 · Craft 4 · Fit 4
Stance: carry it, as **the output**. No dashboard comes before this PR.

### H The Ghost Check
Reaction: the brief's success metric is *fewer reds and fewer review rounds over time*, and this is the only card that prevents a red instead of explaining one. An agent arguing with the agent, then conceding, is a great moment. Strictly it runs the loop forward rather than in reverse, and I'm fine with that.
Remix: *yes, and* ghosts are the Forge's recommendations while they wait for a person. A guard proposed but not yet merged still haunts every PR that touches its paths as advice. Haunt review too: "a human flagged this exact pattern on 1322, thread #…", so pr-care fixes it before the human sees it.
Scores: Wow 5 · Value 5 · Craft 4 · Fit 4
Stance: carry it, as **the forward edge** where the anti-loop pays back.

### Overall
Carry **G The Reaper PR**, **A Hindsight Forge** and **H The Ghost Check**, with **B As-Built** as the Reaper's body and **E The Oath Deck** as the KB surface if the panel wants a fourth.

The merge I see is **one rewind, three tenses**:
- **Past (the Forge):** every cause is replayed across all 171 shipped PRDs and proven before anyone sees it.
- **Present (the Reaper PR):** each shipped PRD, and each nightly sweep, ends as one PR. Its body is the As-Built overlay, it has one hunk per finding, each hunk has its Black Box recommendation ID and replay receipt, and a rejected hunk becomes a deliberate KB line.
- **Future (the Ghost):** while a person hasn't merged it, every recommendation haunts new PRs as an arguing check.

That is the version a lead engineer forwards. The safe version, a "findings dashboard", is what I refuse.

#### craft

Shots: `r1/panel/shots/<id>.png` (1440 wide, headless Chrome). I judged each card against the fuel sheet's `design` section first, then the craft floor. One finding applies to seven of the eight cards, so I state it once here. Every card except F wears the arcade/HOME costume: Anton headlines, Press Start 2P eyebrows, neon on void. Yet A, B, C, D and E would live on the app pages (`/prd/<id>`, `/app`, `/knowledge`). The design form calls those pages a reading surface. They use Ask's tokens in Omni, Light and Dark, set reading copy in Atkinson at 17 px on 1.6, and show the pixel face only in the header wordmark. Anton belongs to HOME's ad headlines. The brief does not ask for that move, so I object to it on every one of those cards. G and H would live on GitHub, so for them the craft is in the PR body and the check text, not the chrome.

### A Hindsight Forge
Replaying a guard across all 171 shipped PRDs before anyone sees it is the right proof. The 171-tick strip is honest data, not decoration. But the card is built on the hero-metric template the floor refuses (big pink `9/171`, small label). It also stacks three eyebrows. Its figures (`9`, `+6 more PRDs · 14 red runs · 2 review threads`, `1904 · 1 red · quick`) are not in the evidence. This product has a locked rule that the model never carries a number it did not copy from evidence.
**Yes, and…** drop the big number and let the strip carry it: each pin is a PRD, and pressing it opens that PRD's red run. "0 false alarms in replay" then becomes a pin state (hollow = would have fired, green on that run), so no stat stands in for it.
`Wow 4 · Value 4 · Craft 2 · Fit 3`
Stance: right engine (the guard proven on history), wrong frame; it belongs inside a surface, not as a page.

### B As-Built
This is the most legible board of the round. Promised on the left, shipped on the right, and the one unclaimed file and one drifted law are marked in place. It answers priorities 1 and 4 for a PRD at a glance, and the dashed `no claim` cell is a real empty state. The faults: it is drawn in arcade costume for what is a PRD-page tab, and `job-<id>.jsonl, never read` is invented.
**Yes, and…** make it a tab on the `prd-dossier` screen, beside Retro, in Ask tokens. Each right-hand cell links to the line on main at the merge sha. Add two rows the board lacks: a `red` row under the claim whose test went red, and a `review` row under the claim a person had to point out. Then all four priorities sit in one alignment.
`Wow 4 · Value 5 · Craft 4 · Fit 4`
Stance: my strongest craft candidate; restyle it to the reading surface and it ships as a tab.

### C Black Box
Swimlanes per signal (checks, quick, review, outbox, territory) with a playhead parked on the third red. It is the most deliberate interaction in the round and lands exactly on what the Retro tab already holds (`retro.json` runs, `territory:s1/s5`). `0 reviews · 0 threads` written into the empty review lane is the honest empty state the floor asks for, and every number traces to 1628's retro.
**Yes, and…** make the scrub the one authored motion: on load the playhead slides back once, ease-out, from SHIPPED to the worst finding. After that ←/→ steps event to event, the `reverse-next` of rr. The review lane should show threads tagged with what the agent missed, so priority 3 has a body.
`Wow 4 · Value 4 · Craft 4 · Fit 5`
Stance: the per-PRD surface; its home is `/prd/<id>?tab=retro`, not a new page.

### D The Dig
The nightly sweep is the right cadence, and "buried under later layers, the newest 1904" is a valuable sentence: it names the PRD that made a line stale. The strata themselves are decoration. The wavy bands, equal layer heights and arbitrary columns encode nothing beyond order, and eight of 171 layers already fill the panel, so it cannot scale. `FIND 07` is a section number with no meaning, and the right panel is half empty.
**Yes, and…** keep the sentence and drop the trench. Make the sweep a list of weathered lines, grouped by the PRD that weathered them, newest first. "Is the sentence still true?" becomes two states: evidence moved, or claim false.
`Wow 3 · Value 3 · Craft 2 · Fit 2`
Stance: right question, wrong picture.

### E The Oath Deck
The state vocabulary is the best craft idea of the round: shining (a test proves it), cracked (cited code moved), unsworn (proposed), unseen (no Governs). It also separates "the evidence is old" from "the sentence is false", and the card checks and says "Still true? yes". Its numbers come from `kb status` (189, 20, 59, 10). But the tilted cards hurt reading, the gold glow is the zero-offset halo the floor refuses, and Anton on a `/knowledge` card is the ad face on a reading page.
**Yes, and…** turn the four states into filters and a status column on `/knowledge`, in Ask tokens, with cards flat. Then the drift sweep has a place to land and a state per entry to move. "Mend → a person seals" becomes the existing harvest/law flow (proposed → judged → enforced), not a new ceremony.
`Wow 4 · Value 4 · Craft 3 · Fit 3`
Stance: keep the states, lose the deck.

### F Entropy Hunt
This is the only concept that rightly wears the costume. Entropy is the product's own word, the arcade has wounds, and `WOUND_CLOSED` already exists for a guard merge. But the planets and sun are smooth CSS radial gradients with a glow, which leaves `draw.ts` and the rule that pixel art is drawn only at whole-number scales. The wraith's health bar has no unit, and `+5/+20/+40 XP` invents economy the rulebook does not hold.
**Yes, and…** add a new wound kind (call it `haunt`) shared by every planet one cause hit. Show it on `planet-overlay`'s ENTROPY tab and draw it with the sprite forge. It closes when the guard PR merges, so the bounty rides the existing wound and clawback events, not new XP.
`Wow 4 · Value 3 · Craft 3 · Fit 4`
Stance: the game's echo of the anti-loop, not the anti-loop; it needs another concept underneath.

### G The Reaper PR
Output as nothing but a diff, with every hunk tagged by kind (RED, DRIFT, REVIEW, UNNEEDED) and by its source. That is the brief's success criterion made literal. "Drop a file to reject it; the rewind remembers why" is a deliberate reject state. But one PR mixes a 418-line deletion with a KB fix and a guard, so a disputed deletion holds the guard hostage. Its REVIEW hunk cites a review on a PRD whose retro says 0 reviews, and `legacy-token.ts` is invented.
**Yes, and…** order the hunks in the PR body by the person's priorities (drift, red, review, unneeded). Let the PR care tab show accept/drop per hunk. Split deletions above a threshold into their own PR, so a guard never waits on an argument about dead code.
`Wow 5 · Value 5 · Craft 3 · Fit 4`
Stance: the right output shape for every concept; the craft is the PR body and the split rule, and this card has neither yet.

### H The Ghost Check
It turns the rewind forward and sits where the App already posts check runs (`outbox`, `omni / budgets`). Its two ghosts are real (1322's retro issue, 1628's F1, #1649), and "third time, no guard exists yet → make it a guard → a person locks it" follows the existing `knowledge judge` / `/omni:enforce` path. The card is missing its states. Does "objects" block, or only annotate? What does the row say with no ghost? And the dialogue bubbles have to read as review comments on GitHub, not as a chat.
**Yes, and…** show the clean state as a row: `anti-loop · no ghost on this diff · 3 checked`. Make the objection a review comment the agent answers through `omni care reply`, so the PR care tab shows the concession as it shows any thread.
`Wow 4 · Value 4 · Craft 4 · Fit 4`
Stance: the best payoff of the round, but it consumes a ledger that someone else (A, C or E) has to build.

### Overall
- **Ranking (craft):** B and C are the deliberate ones: legible, grounded in real data, with honest empty states, and each lands on an existing screen (`prd-dossier`). After them come H and G, which need their PR or check text written, then E (for its states), A, F, D.
- **Shared objection:** seven of eight cards leave the product's tokens for the arcade/HOME costume on surfaces the form calls a reading surface. Round 2 prototypes of A–E must be built in Ask tokens and shot in Omni, Light and Dark. F alone keeps the arcade, drawn in pixel art.
- **Shared gap:** apart from B's `no claim`, C's empty lane and F's `clean · just shipped`, no card shows the case that will be the most common: a shipped PRD where the rewind finds nothing. Nor does any show a finding a person rejected. Both need a designed state.
- **Grounding:** A, B, F and G carry numbers or files that are not in the evidence. Because the retro's own locked rule forbids that, round 2 should mark every figure with its source.
- **Shape I'd push:** C's swimlane as the per-PRD rewind, with B's claim map as its spec lane. E's four states run the continuous sweep on `/knowledge`. G's split PRs are the only output, and H is the forward edge.

#### skeptic

**First, a fact that changes every card.** Five cards (A, C, F, G, H) put "the missing types guard" at the centre. That guard already exists. `scripts/supabase-types.ts --check` has run in `.github/workflows/supabase.yml` ("The database's types are what the migrations generate") since PRD 725 (#726, 2026-10-02), and its test is `scripts/supabase-types.test.ts`. The 1322 and 1628 retros both say "every failure was **the types guard** finding…". So the guard worked both times. What failed is the step after: both retros proposed the same lesson ("regenerate, never hand-edit") and both say under **Kept** that the knowledge base has no such rule. `git grep` shows it still has none. The `generated:` block in `.omni-loop/config.yml` lists `kit/dist/` and `apps/omni-app/api/` but not `supabase/database.types.ts`. Also, 1322's issue is **#1349**, not "a retro issue". The real loop gap is **retro lesson → KB / config, never landed**, not a missing test. Any concept that can't tell "no guard" apart from "guard fired, lesson dropped" will propose duplicate work on day one.

**Numbers the artists made up** (checked against the fuel sheet and the repo):
- A: "9/171", "14 red runs", "2 review threads", "0 false alarms", "1904 s2 1 red · quick", and the path `supabase/checks/types-match-migrations.test.ts`.
- B: "12/12 met", "46 lines", "law: logs stay in log_tail". The "`job-<id>.jsonl`, no claim, DELETE?" row is **false**: spec 1904 claims the jsonl at lines 54, 167 and 225.
- F: the XP amounts, and "1322 wound reopened".
- G: "−418 +37", `apps/galaxy/src/auth/legacy-token.ts` and `kit/lib/signin/device-flow.ts` (neither file exists), and the cookie-path rule.
- H: #1915 and the whole s2 dialogue, including "1628's s1 said the same in its outbox".
- C, D and E use only real numbers (1628's retro facts; 171 / 59 / 10 / 189 / 20 from `kb status`).

### A Hindsight Forge
Replaying history as a test suite for a proposed guard is the most rigorous idea on the table. But its demo guard already exists and already ran red on 1628, so the replay would "catch" what was caught. Replay is also costly: each historical PRD has to be checked out at its slice commits, and migrations need a database.
must be true:
- A finding can be expressed as a check that runs on a past tree (many can't: review causes, KB truth).
- Past trees still build: lockfile, pnpm version and Node all changed over 171 PRDs.
- It first checks whether a guard already exists and fired. If it did, the action is a rule or a shift-left, not a new guard.

remix: *yes, and* replay the **lesson** instead of the guard. For each recurring finding, ask "did the guard fire earlier than CI could have?" Propose moving it left: add `database.types.ts` to `generated:`, or run `supabase-types --check` in `check:changed`/pre-commit when `supabase/migrations/` changed. Score it on the reds it would have saved.
Wow 4 · Value 4 · Craft 3 · Fit 3
stance: strong spine, wrong demo. The replay should prove *shift-left*, not invent guards that exist.

### B As-Built
Spec ↔ code ↔ KB per claim is the only concept that seriously takes on priority 4 (is the code required?). Its own demo shows the risk: the one "nobody asked" row is wrong, because the spec claims the jsonl in three places. Mapping prose claims to code is a model judgement, and a false DELETE? on a deletion PR costs trust fast.
must be true:
- Claims are addressable. 1904's ACs are numbered and its test seams name files, so it works there; older specs may not be.
- A "no claim" verdict needs two independent signals (fallow says unused AND no spec/plan/decision mentions it) before anything is proposed for deletion.
- The KB column judges sentence truth, which no tool does today. `kb status` only knows `file@sha` moved.

remix: *yes, and* start from the plan's **territory table** (the principle "judges a slice against the plan's table, never its prose" is already locked). For each file a slice touched, find the AC or test seam that names it. Only the remainder goes to a person, and as a question, never a deletion.
Wow 4 · Value 4 · Craft 4 · Fit 4
stance: best answer to priority 4. Must ship as questions before it ships as deletions.

### C Black Box
The most honest card: every number is from 1628's real retro. It is basically the retro's next step: cause, then recommendation, addressed to whoever owns the fix, with recurrence linked. Its recommendation is wrong for the same reason as A's: the guard exists. The right recommendation is "a KB rule plus shift-left".
must be true:
- Recurrence linking works across retros. P-PRODUCT-16 keeps identity *within* one PRD's runs; 1322 (#1349) and 1628 (#1649) were never linked.
- A recommendation names an addressee that exists. The `review` form is missing and the ci form's Known reds is empty.
- It is per-PRD only, so it does not answer the continuous-sweep half of the brief alone.

remix: *yes, and* make it the retro's fourth step, not a new product. The retro already has `facts → narrate → guard → publish-issues`. Add `recommend`: look up earlier `omni:retro` issues with the same finding key, and if one exists, reopen it and escalate. "Second occurrence" becomes a KB-rule PR.
Wow 3 · Value 5 · Craft 4 · Fit 5
stance: the cheapest real win. Extend `apps/omni-app/src/retro`, don't build beside it.

### D The Dig
Strata of PRDs over the repo is a lovely image for the continuous sweep, with real counts (171 shipped, 59 stale, 10 ungoverned). But the card's FIND 07 just restates `kb status`'s stale-evidence line with a better frame. The hard question, "is the sentence still true?", is asked and not answered.
must be true:
- Commits map to PRDs. They mostly do via `(PRD n)` / `(#n)` in titles, but chores, merges and releases don't.
- A nightly sweep has a budget. 59 stale lines × a model judgement each, every night, with a no-change skip.
- A layer view adds a decision a list wouldn't. Otherwise it is decoration over `kb status`.

remix: *yes, and* sort the 59 stale lines by **which PRD moved the cited file**. That turns "stale evidence" into "PRD 1904 may have broken architecture.md §x", which goes to the person who shipped it, in that PRD's retro.
Wow 4 · Value 3 · Craft 3 · Fit 3
stance: good frame for the sweep, too thin underneath. Needs B's judgement inside it.

### E The Oath Deck
A strong frame for priority 1, and it is the only card that admits the hard part: "The anti-loop checked the code: yes. Only the evidence is old." That one sentence is the whole product, and it is model judgement nobody has built. The states map well onto real fields: Enforced by, Proposed, Governs, `@sha`.
must be true:
- Re-verifying a line against the code is cheap and right most of the time. A model saying "still true" must cite the lines it read, like the retro's no-invented-numbers guard.
- "Mend = re-stamp the sha" stays distinct from "mend = rewrite the sentence". The first must not become a rubber stamp.
- The 20 unsworn have an owner who seals. Today nobody locks harvested proposals.

remix: *yes, and* add a fifth state, **"lesson never landed"**: a retro lesson proposed twice with no matching KB line. Today that card is "regenerate database types, never hand-edit", 2 retros, 0 rules. It is the most valuable card in the deck and none of the others show it.
Wow 4 · Value 4 · Craft 4 · Fit 4
stance: a strong home for priority 1. Its value rests entirely on the "still true?" check being trustworthy.

### F Entropy Hunt
Fit with the game layer is real: there is no event or wound for red CI, review rounds or stale KB today, and Entropy is the right word. But rewarding with XP the closing of things the anti-loop itself generates invites gaming, such as 59 cheap re-stamps at +5 each. And its boss is the guard that already exists.
must be true:
- A bounty is paid on a verified outcome (the recurrence stops), not on a closed issue.
- The game stays a layer: findings must work with the game switched off.
- The skeptical devs (F-E, B-E personas) aren't put off by a boss fight over their CI red.

remix: *yes, and* pay the bounty only when the **next** PRD that touches the same ground ships without the finding recurring, so the kill is proven by the future.
Wow 4 · Value 2 · Craft 3 · Fit 3
stance: a skin for C or E, not a concept of its own.

### G The Reaper PR
"Output is only a diff" is the right discipline: every finding ends in an action, which is the brief's success line. But the card's two big deletions are files that don't exist, and the −418 is the headline. A mixed PR (guard + KB + deletion) also has the worst review cost: one bad hunk stalls all of them, and "drop a file to reject it" means a person edits a bot's PR.
must be true:
- One PR per finding kind. KB fixes, guards and deletions have different reviewers and risk.
- Deletion needs B's two-signal proof. fallow already blocks *new* dead code, and its baseline is what's left to sweep down.
- Rejections are remembered (P-PRODUCT-16 identity), or it re-proposes the same hunk nightly.

remix: *yes, and* the first Reaper is **fallow-baseline-down**: one PR a week that removes entries from `fallow/dead-code.json` whose code no spec claims, with the regeneration allowed exactly as `fallow/README.md` says ("only in a PR that clears findings").
Wow 4 · Value 4 · Craft 3 · Fit 4
stance: the right output format for the whole idea. Its demo content is invented.

### H The Ghost Check
Shifting left is right. It's my remix of A, already shaped as a product. But an agent arguing with an agent in a check is the expensive way to do something a deterministic hook does for free. "Migration changed and database.types.ts didn't come from `supabase-types.ts`" is a rule, not a debate.
must be true:
- The ghost only speaks when it has a deterministic trigger (path pattern plus a past finding key). Otherwise it is noise on every PR.
- The agent's concession is checked, not trusted: the check re-runs.
- The ghost's objection becomes a guard after N occurrences, or it argues forever.

remix: *yes, and* the ghost's whole job is to **graduate itself**. On the first recurrence it comments; on the second it opens the PR that puts the check in `check:changed`/pre-commit; then it goes silent, because the hook catches it.
Wow 5 · Value 4 · Craft 3 · Fit 4
stance: the best *moment*; the wrong *mechanism* if it stays a debate.

### Overall
Smallest proof first, about a day, read-only. Run one script over the 10 existing `retro.json` files plus the 60 `omni:retro` issues:
1. Group findings by `kind:key` and cause text across PRDs. That is the recurrence linking nobody does today.
2. For each group, check three things: does a guard exist (git grep the check), does a KB line exist (`kb laws`/forms), and could it have fired earlier (pre-commit / `check:changed`)?
3. Print one table.

My prediction: the top row is "types drift, 2 PRDs, guard **exists**, KB rule **missing**, shift-left **missing**". The action is a two-line PR (add the rule, and add `database.types.ts` to the shift-left), not a new guard. If the table shows that pattern more than once, the anti-loop's first product is **"lessons that never landed"**, built as a step in the existing retro (C) and shown as E's cards, not a new engine. If it shows nothing, we just learned that the per-PRD rewind is not where the value is, and the sweep (B on priority 4) should lead.

#### value

My question: what changes for the business if this ships? The business sheet is thin. It has `offering#316` (open core + hosted app), `rival#44` (mastra), `trade#38` (software) and the Benelux/FR/CH regions (`region#5/6/12/84/238`). `offering#36` (developer tool) and `size#37` are contradicted, so I do not use them. The value case therefore rests on two things. First, the hosted app has to prove the loop gets better over time (`offering#316`). Second, the people who resist adoption have to be won over: two skeptical developers, a neutral Lead Engineer, and Paul, who wants to ship faster. The fuel shows how weak the feedback loop is today. Only 10 of 171 shipped PRDs have a retro. 15 of 25 retro PRs were closed unmerged. The same root cause showed up in 1322 and in 1628 (#1649) and was never linked. The CI form's Known reds list is empty, and the review form is missing. A concept earns value when its finding ends as a merged action, not as a report.

### A Hindsight Forge
Reaction: Of the eight, this one has the strongest ROI story. "This guard would have caught 9 of 171 PRDs, with 0 false alarms in the replay" is a number a Lead Engineer can take into a meeting. Proving each guard against the whole history before anyone sees it answers the developers' fear of noise. It also produces the trend line ("fewer reds per PRD") that the brief names as its success measure.
Remix: yes, and every forged guard carries a running "saved" counter (red runs and review rounds avoided since it merged). That counter goes on the hosted app's dashboard as the loop's own DORA-style instability line. It is the renewal argument for `offering#316`.
Scores: Wow 4 · Value 5 · Craft 4 · Fit 4
Stance: Backbone candidate. It turns priority 2 (why red) into money-shaped proof. Weak on priority 1 (KB drift) and priority 4 (is the code required).
Claims: `offering#316`

### B As-Built
Reaction: This covers priorities 1 and 4 in one page per PRD: the promised spec, the shipped code and the KB, compared claim by claim. It is the most legible "is that code even required?" answer for a PM like Paul or Irisa, who think in claims, not files. The weak point is that it ends in three proposed PRs. Unless they get merged, it is one more report, and today 15 of 25 retro PRs die unmerged.
Remix: yes, and the As-Built becomes the PRD's closing artifact on its dossier page, the "certificate of what we shipped". Any claim with no code, or code with no claim, keeps the planet's wound open until someone acts. Then the finding cannot be ignored.
Scores: Wow 4 · Value 4 · Craft 4 · Fit 5
Stance: Strong per-PRD half. It needs a forcing function so its PRs actually merge.
Claims: `offering#316`

### C Black Box
Reaction: The NTSB framing is right: a recommendation addressed to whoever can act. Business-wise, though, it is the existing retro with better staging. Per-PRD, one PRD at a time, it repeats the model that already covers only 10 of 171 PRDs. The "seen before in 1322" link is the valuable part, and A does that at scale.
Remix: yes, and its value is as A's drill-down. Clicking one of A's 9 "would have caught" PRDs opens that PRD's black box at the red run. Do not ship it standalone.
Scores: Wow 3 · Value 3 · Craft 4 · Fit 4
Stance: Fold into A as the per-PRD view, not a concept of its own.
Claims: none needed

### D The Dig
Reaction: This is the continuous sweep the person asked for, and it targets priority 1 directly: 59 stale-evidence lines and 10 ungoverned rules. The value is real, because a KB that agents trust but that has silently drifted is a quality liability for every PRD after it. The strata metaphor costs a lot of craft for a nightly job that a maintainer mostly wants as a short list.
Remix: yes, and the trench output is ranked by blast radius: how many open PRDs touch the paths of the buried sentence. The top three become docs PRs each morning, and the rest wait. That keeps the weekly cost to a person bounded.
Scores: Wow 4 · Value 4 · Craft 3 · Fit 4
Stance: Right job, heavy dress. The sweep engine is worth keeping, the metaphor optional.
Claims: none needed

### E The Oath Deck
Reaction: This is the best answer to priority 1 for the maintainer. Shining, cracked, unsworn and unseen are four states a person grasps at once. "Checked the code: still true, only the evidence is old" is exactly the triage that saves human time. The business value is trust: a KB a Lead Engineer can see is healthy is what lets the skeptical developers rely on agent output. Its reach is limited to KB drift.
Remix: yes, and the deck's health ("171 of 189 shining") becomes a public badge on the open-core repo and the hosted workspace (`offering#316`). A visible, self-mending knowledge base is a differentiator a buyer can see before installing.
Scores: Wow 4 · Value 4 · Craft 5 · Fit 5
Stance: The best surface for the KB half. Pair it with a CI/review engine.
Claims: `offering#316`

### F Entropy Hunt
Reaction: It fits the game layer neatly: entropy and wounds already exist, and no wound exists for a red run or a stale KB entry. But the business-facing personas here are skeptical developers who fear "fluff". Turning drift into a boss with XP bounties risks confirming the gimmick reading. The motivational lift lands with players who are already convinced.
Remix: yes, and the boss is only the game skin over A's recurrence engine: a recurring cause becomes a wound across planets, and merging the guard closes it. One engine, with the game as an opt-in view for the fleet.
Scores: Wow 4 · Value 3 · Craft 4 · Fit 3
Stance: A skin, not a product. Keep it as the game layer's reading of A or D.
Claims: none needed

### G The Reaper PR
Reaction: This is the most direct hit on the brief's success measure: "every finding ends in an action". There is no report to ignore, only a diff in which every hunk cites its red or review. For the skeptical developers, a −418-line PR is the strongest possible rebuttal to "AI makes slop". The risk is that one PR bundling guard, KB fix, review-form seed and deletions is hard to review. If a reviewer rejects it whole, the value goes to zero.
Remix: yes, and the Reaper splits by kind into one stack (guard / KB / deletions), each mergeable alone. A dropped hunk is remembered and never proposed again (P-PRODUCT-16-style identity). Merged-hunk rate becomes the anti-loop's own KPI.
Scores: Wow 5 · Value 5 · Craft 4 · Fit 4
Stance: Output format of the winner. Whatever engine wins should end as Reaper PRs.
Claims: none needed

### H The Ghost Check
Reaction: This one has the highest business leverage, because it moves the lesson before the red, while the others count reds after they happen. Fewer reds and fewer review rounds per PRD is the brief's success measure. A ghost check delivers that directly, and it hits Paul's speed goal. But it is forward, not reverse, and it only works once the recurrence has been found. It depends on A or D existing first.
Remix: yes, and every ghost check that the agent concedes three times auto-proposes its own guard (the "MAKE IT A GUARD" button becomes the default). The ghost is temporary by design, and success is ghosts retiring into tests.
Scores: Wow 5 · Value 5 · Craft 4 · Fit 3
Stance: Phase 2 payoff. It is the part that bends the curve, but it needs the reverse engine underneath.
Claims: none needed

### Overall
- **Bet I would back:** the A engine (recurrence across all shipped PRDs, guards proven on history) plus B per PRD (claim-to-code, priorities 1 and 4), both shipping through G-style split PRs. E is the KB surface, and H is phase 2, where the lessons move upstream.
- **What changes for the business:** the hosted app (`offering#316`) gets a measurable claim that the loop learns, with reds and review rounds per PRD trending down and a "saved" counter. That is the line that separates a delivery loop from an agent framework (`rival#44`). I make no claim about mastra's features; the sheet holds none.
- **Gap across all eight:** none answers priority 3 (why a PR needed a human review) with real depth. Today the retro counts threads only, and the review form is missing. Whichever concept wins must seed `review.md` from review threads. Otherwise half of "fewer review rounds" goes unmeasured.
- **Weakest on value:** C (duplicates today's retro) and F (reinforces the "gimmick" reading among skeptics).

#### users

Five voices, each from its own fuel-sheet entry (`## personas`). Question per voice: "Would I use this at 7am on Monday?" — a developer mid-PR in the terminal; a PM before planning; Irisa on her phone between customer calls. Scores 1–5: Wow / Value / Craft / Fit. No Feasibility in round 1.

### A Hindsight Forge
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | A test file that goes red on 1628's s1 and green on main, with 0 false alarms in replay, is the opposite of slop: proof before I'm asked to trust it (persona:F-E Developer). | yes, and show me the replayed red run inline in my PR, so I see the guard bite before I merge it. | 4/5/4/4 | for — a guard proven on history is the only AI output I'd merge. |
| B-E DEv | Finally not fluff: the output is a `.test.ts` I can run myself, not a dashboard (persona:B-E DEv). | yes, and let me run the replay from the terminal on my own branch, `omni replay <guard>`. | 4/4/4/4 | for — a tool, not a gimmick. |
| Paul - Product Manager | 14 red runs saved across 9 PRDs is time I get back for features (persona:Paul - Product Manager). | yes, and run it across every repository I build in, not just this one. | 4/4/4/3 | for, but it's one guard at a time — I want the batch. |
| Lead Engineer | One cause, one guard, all teams covered — that is cohesion I can point to (persona:Lead Engineer). | yes, and list the forged guards on the board I already look at, with what each has caught since. | 4/4/4/4 | for — it earns trust by evidence. |
| Irisa | I'm glad it stops reds, but `types-match-migrations.test.ts` means nothing to me on my phone (persona:Irisa). | yes, and tell me in one plain line which of my PRDs shipped faster because of it. | 3/3/4/2 | neutral — good for the team, invisible to me. |

objection (persona:Irisa): I push customer quick wins and don't master the technical harness, and this card speaks only harness — a guard path and red counts, nothing a customer would notice (persona:Irisa).

### B As-Built
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | "AC4 untested" and a file nobody asked for is exactly where production bugs hide; I'd read this before trusting any agent-built PRD (persona:F-E Developer). | yes, and link each claim to the test that proves it, so "met" means tested, not "found in a file". | 4/5/4/4 | for — it catches the slop I fear. |
| B-E DEv | Code read back into a spec is useful, if the reading is right; if it's an LLM paraphrase it's fluff (persona:B-E DEv). | yes, and each "met" row cites the exact line range, so I can check it in ten seconds. | 3/4/3/3 | cautious — show the receipts. |
| Paul - Product Manager | 12/12 claims met is a sentence I can say in planning, but three extra PRs per shipped PRD slow the next one (persona:Paul - Product Manager). | yes, and fold the three PRs into one so it costs me one review, not three. | 4/3/4/2 | lukewarm — great proof, extra queue. |
| Lead Engineer | Promised vs shipped vs the law, one row per claim: that is the board I'd actually open on Monday (persona:Lead Engineer). | yes, and roll it up across all PRDs so I see which team's specs drift most. | 4/5/4/5 | strongly for — cohesion made visible. |
| Irisa | I can read "Jump to latest — met" without knowing the harness; it tells me the customer got what I promised (persona:Irisa). | yes, and a phone view with only the claims, green or not, no file names. | 4/5/4/5 | for — it speaks my language. |

objection (persona:Paul - Product Manager): I want to ship as many features as possible in very little time, and this ends every shipped PRD with three more PRs to review before I move on (persona:Paul - Product Manager).

### C Black Box
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | A probable cause with the exact file hand-edited is honest and blameless; I like that it names the cause, not a person (persona:F-E Developer). | yes, and play the same rewind on a review thread, not only a red check. | 3/4/4/3 | mild for — but it comes after the crash. |
| B-E DEv | "NTSB-style safety recommendation" is costume; the useful bit is the one-line cause, which the retro already has (persona:B-E DEv). | yes, and drop the aviation theatre: print the cause and the guard in `omni prd 1628`. | 2/3/3/2 | against — dressed-up retro. |
| Paul - Product Manager | It tells me why 1628 took 655 minutes, but only for one PRD at a time (persona:Paul - Product Manager). | yes, and file recommendations automatically so I never read the report. | 3/3/3/3 | neutral. |
| Lead Engineer | Investigating one PRD end to end is how I'd run a post-mortem; addressing the fix to the playbook is right (persona:Lead Engineer). | yes, and show me which open recommendations nobody acted on yet. | 4/4/4/4 | for — mirrors how I work. |
| Irisa | A flight timeline of my PRD is readable, but it's still a crash report, not a quick win (persona:Irisa). | yes, and one line on top: "this cost you X hours; this guard saves them next time". | 3/3/4/3 | neutral. |

objection (persona:B-E DEv): I already see this tool as a gimmick, and an aviation report for three red runs confirms it — the retro already names the cause (persona:B-E DEv).

### D The Dig
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | Nightly finds of code no spec claims are useful; strata of layers is pretty but I'd never open it mid-PR (persona:F-E Developer). | yes, and only ping me when a find touches files I own. | 3/3/3/2 | lukewarm. |
| B-E DEv | Archaeology metaphor for a git blame on knowledge files — fluff on top of a decent sweep (persona:B-E DEv). | yes, and give me the sweep as a CLI report, no trench. | 2/3/3/2 | against the skin, fine with the engine. |
| Paul - Product Manager | A nightly sweep I don't run is good; a trench I must read is not (persona:Paul - Product Manager). | yes, and turn each find straight into a PR so nobody digs. | 3/3/3/2 | neutral. |
| Lead Engineer | 59 weathered lines across the whole repo is the cohesion picture I lack — whole repo, every night (persona:Lead Engineer). | yes, and group finds by team area (kit, app, galaxy, supabase) so each lead owns theirs. | 4/4/3/4 | for — the continuous half I need. |
| Irisa | I wouldn't read a trench on my phone; "is the sentence still true?" is a question I can't answer (persona:Irisa). | yes, and only send me finds where a customer-facing promise changed. | 2/2/3/1 | against — not for me. |

objection (persona:Irisa): I'm held back by a technical harness I don't master, and this asks me whether an architecture sentence citing a README commit is still true (persona:Irisa).

### E The Oath Deck
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | Knowing which rule is proven by a test vs merely written down tells me which ones I can trust (persona:F-E Developer). | yes, and a "cracked" card must say which of my files moved under it. | 3/4/4/3 | mild for. |
| B-E DEv | Cards that age and a "seal" — gamified housekeeping (persona:B-E DEv). | yes, and `omni kb cracked` listing the same thing in the terminal. | 2/3/4/2 | against the deck, for the data. |
| Paul - Product Manager | 59 cracked rules are 59 things that may misguide my agents; mending in one click is fine if it's one click (persona:Paul - Product Manager). | yes, and mend them all in one batch PR. | 3/3/4/3 | neutral. |
| Lead Engineer | The knowledge base is how I keep teams coherent; seeing which lines are sworn, cracked or unseen is exactly my job, and it fits a quick look (persona:Lead Engineer). | yes, and make the deck the landing page of `/knowledge`. | 5/5/4/5 | strongly for — top pick. |
| Irisa | A card I can swipe on my phone at 7am, one rule each, is the first thing here I'd actually use there (persona:Irisa). | yes, and show me the customer-facing rules first. | 4/4/5/4 | for — readable and mobile. |

objection (persona:B-E DEv): I see this as fluff, and calling rules "oaths" with a "seal" turns a stale-evidence list into a card game I'd skip (persona:B-E DEv).

### F Entropy Hunt
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | A boss for hand-edited types makes a real problem feel like a toy; I fear that's how slop gets waved through (persona:F-E Developer). | yes, and the bounty pays only when the guard has caught a real red. | 2/3/3/2 | against. |
| B-E DEv | XP for fixing stale evidence is the gimmick I expected from this tool (persona:B-E DEv). | yes, and keep the hunt list, drop the XP. | 1/2/3/1 | against. |
| Paul - Product Manager | If bounties get the fleet to kill recurring reds faster, I'm in — anything that keeps PRDs moving (persona:Paul - Product Manager). | yes, and bounties bigger on drift that slows my PRDs most. | 4/3/3/3 | mild for. |
| Lead Engineer | Linking 1322 and 1628 to one cause is right; making it a boss risks teams chasing points instead of cohesion (persona:Lead Engineer). | yes, and count shared kills, not individual ones. | 3/3/3/3 | neutral. |
| Irisa | Fun on the arcade, but it doesn't help me ship anything to a customer (persona:Irisa). | yes, and hunts named by the feature they slowed. | 3/2/3/2 | neutral. |

objection (persona:B-E DEv): I already think this is fluff, and XP for "59 stale evidence" proves my point (persona:B-E DEv).

### G The Reaper PR
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | An agent deleting 418 lines, 212 of them in auth, is exactly the production bug I fear — "fallow says unused" isn't enough (persona:F-E Developer). | yes, and split deletions into their own PR, each with a green e2e run on the flows it touches. | 3/3/4/2 | against as one PR; for the guard hunk. |
| B-E DEv | A diff, nothing to read but code, every hunk citing its red — this I'd actually use (persona:B-E DEv). | yes, and let me drop a hunk from the CLI with a reason that the next rewind remembers. | 5/5/5/5 | strongly for — top pick. |
| Paul - Product Manager | One PR, one review, the debt paid — no report to read before planning (persona:Paul - Product Manager). | yes, and one Reaper per repository I build in, every week. | 5/4/4/5 | strongly for. |
| Lead Engineer | Mixing deletion, KB fix and a new guard in one PR is hard to review cohesively, but the hunk-to-finding link is excellent (persona:Lead Engineer). | yes, and label each hunk RED / DRIFT / REVIEW / UNNEEDED in the PR's file list. | 4/4/4/3 | for, with a split. |
| Irisa | I'd never review a −418 diff; I'd have to trust someone else's merge (persona:Irisa). | yes, and a one-line summary per hunk I can read on my phone. | 3/3/4/2 | neutral. |

objection (persona:F-E Developer): I fear AI creating slop and bugs in production, and an agent PR that deletes 212 lines in `auth/legacy-token.ts` because no spec claim names it is that fear in one diff (persona:F-E Developer).

### H The Ghost Check
| persona | reaction | remix | W/V/C/F | stance |
|---|---|---|---|---|
| F-E Developer | Stopping the red before it happens, on my PR, in the middle of my work — the best answer to "AI makes bugs" (persona:F-E Developer). | yes, and when I'm the one editing, the ghost argues with me too, not only the agent. | 5/5/4/5 | strongly for — top pick. |
| B-E DEv | A check that cites two real prior reds is a tool; agents arguing in comments is a bit of a show (persona:B-E DEv). | yes, and make the objection a plain check status with the command to clear it. | 4/4/4/4 | for. |
| Paul - Product Manager | The red never happened: that's the fastest PRD I can have (persona:Paul - Product Manager). | yes, and run it on every repository's PRs, not just this one. | 5/5/4/5 | strongly for. |
| Lead Engineer | It acts before shipping, so it covers only "why CI red", not drift or unneeded code (persona:Lead Engineer). | yes, and also object when a diff contradicts a sworn law. | 4/4/4/3 | for, narrow. |
| Irisa | If it fixes things before I see them, fine; if it shows me an agent debate on my PR, I'm lost (persona:Irisa). | yes, and tell me only "1 red avoided" on my PRD page. | 3/4/4/3 | neutral-for. |

objection (persona:Irisa): I don't master the technical harness, and a comment thread where a check and an agent argue about `supabase gen types` is harness I'd have to read to know if my PR is fine (persona:Irisa).

### Overall
- **F-E Developer:** 1 H Ghost Check, 2 A Hindsight Forge — prevention with proof; nothing deletes without a test (persona:F-E Developer).
- **B-E DEv:** 1 G Reaper PR, 2 A Hindsight Forge — output is code I can run or drop, no costume (persona:B-E DEv).
- **Paul - Product Manager:** 1 G Reaper PR, 2 H Ghost Check — one PR, fewer reds, nothing to read before planning (persona:Paul - Product Manager).
- **Lead Engineer:** 1 E Oath Deck, 2 B As-Built — the knowledge base and promise-vs-shipped are how I keep teams coherent (persona:Lead Engineer).
- **Irisa:** 1 B As-Built, 2 E Oath Deck — the only two I'd read on my phone, in claims and rules, not file names (persona:Irisa).

### Turn 2 (cross-talk)

#### visionary

**Skeptic, you changed my mind.** The guard fired both times; the *lesson* died. "Two retros said it. Zero rules say it. Here's the two-line PR" is the screenshot. I adopt your fifth card state, **lesson never landed**, as the headline of the whole concept.

**A Forge:** I'm moving it from guard-forge to lesson-replay, Skeptic's remix: "would shift-left have saved these reds?" **Craft**, I agree to kill the `9/171` hero and the invented figures. **Value**, the "saved" counter stays only if every count links to a run. Wow 5→4, Value 5→4, Craft 4→3 (invented figures).

**B As-Built:** Skeptic's "questions before deletions, starting from the territory table" is right. **Craft**, yes to the dossier tab with red and review rows. Craft 4→3, the rest holds.

**C Black Box:** I underrated it. **Skeptic**, a `recommend` step inside the existing retro, which links #1349 to #1649 and escalates, is where "lesson never landed" gets *detected*. Value 4→5, Fit 4→5. I still refuse the aviation costume (B-E Dev is right).

**E Oath Deck:** it rises. It is where the never-landed lesson *lives*. **Craft**, flat cards in Ask tokens on `/knowledge`, agreed; but keep the four state words, they're the product. Wow 4→5, Value 4→5.

**G Reaper:** **Craft, Value, F-E Dev**: split it by kind, agreed. The card's content was fiction (Craft 4→3), but the format stands. The first Reaper should be Skeptic's: KB rule plus `database.types.ts` in `generated:`: two lines, mergeable today.

**H Ghost:** **Skeptic**, "graduate itself" is the remix I missed. Partial challenge: the deterministic trigger fires, but keep the concession as an `omni care reply` thread (Craft), so a person sees a red that never happened. Irisa gets one line: "1 red avoided".

**Overall, revised:** the story is now *lessons that never landed*.
- C's recommend step detects them.
- E's cards hold them.
- G's split PRs land them.
- H's graduating ghost moves them left.

A (as replay proof) and B (questions on priority 4) are the engines underneath.

#### craft

**The moderator's fact moves my scores.** The guard fired both times. What failed is that the lesson never reached the knowledge base (`generated:` omits `database.types.ts`, and the ci form's Known reds is empty). The demo is a priority-1 drift case, not a CI case.

- **E fits it best:** the ci-form line reads *cracked/unseen*. Value 4→5. Craft stays 3: tilted cards, a zero-offset halo, Anton on a reading page. **Value**, I challenge your Craft 5: the states earn a 5, the card does not. Your badge "171 of 189 shining" is also an invented number in a hero-metric frame.
- **A: Value 4→3.** **Skeptic** is right: replay would "catch" a guard that already caught. I adopt Skeptic's shift-left remix: each pin shows where the guard *could* have fired (pre-commit, `check:changed`) against where it did (`checks`).
- **H: Value 4→5.** Moving the existing guard left is H's job. **Value**, I keep Fit 4, not 3: the App already posts check runs.
- **G:** the honest hunk is now `config.yml generated:` +1 line plus a ci.md Known-reds line, not a new test. A smaller PR is better craft. **Visionary**, I build on your "rejected hunk becomes a deliberate KB line": that is the reject state I asked for.
- **B:** **Skeptic** showed that the spec claims `job-<id>.jsonl` three times. I had called it invented; it is in fact false, so the board demoed a false deletion. I change my remix: `DELETE?` becomes a question state (`no claim found · ask`) until two signals agree. Scores stay. **Users** (Irisa reads claims, on a phone) back the restyle to Ask tokens.
- **C:** **Visionary**, I challenge "better typography". C alone shows *when* a red happened, and shift-left needs exactly that. With **Skeptic**: make it the retro's `recommend` step. Fit 5 stays.
- **F:** **Visionary**, I adopt your wound name `recurrence` over my `haunt`. It should still be drawn by the forge, not in CSS gradients.

Revised: A `4·3·2·3` · E `4·5·3·3` · H `4·5·4·4`. The rest are unchanged.

#### skeptic

**Visionary, Value:** you both made A the backbone on "9/171, 0 false alarms". The artist invented that number. Its one real example is a guard that already fires: red three times on 1628, seven times on 1322. Replayed today, it proves a guard we already have. Value, your "saved counter" still works if it measures reds *after a lesson lands* versus before. **A moves: Value 4→3.** I keep the engine and drop the headline.

**Visionary, "three tenses":** I agree. But a Ghost that haunts every PR while a recommendation sits unmerged is a nag, and the skeptical developers will mute it. It needs a deterministic trigger (a path plus the key of a past finding). After the second time it fires, it graduates into a hook.

**F-E Developer (Users):** you asked for prevention with proof. A hook gives you that; an agent's opinion doesn't. **H moves: Value 4→5.** It fixes the real case: `supabase-types --check` in `check:changed` when a migration changes.

**Value, Visionary on C:** you're right, C isn't a concept of its own. My stance changes: C is the **host**, a `recommend` step in `apps/omni-app/src/retro` that links findings across PRDs (#1349 ↔ #1649) and feeds A and E. Scores unchanged.

**Value, on priority 3:** agreed, and it's harder than it looks. `pull_request_reviews` keeps only the first review per reviewer, not the thread text, and 1628 had 0 reviews. What must be true: threads get gathered with their text, and the missing `review` form is seeded first.

**Craft:** building on your "nothing found" and "rejected" states. A rejection must keep its identity (P-PRODUCT-16) and become a KB line saying why. Otherwise the sweep re-proposes it every night. That is the Reaper's real gate.

**Lead Engineer, Irisa (E, B):** I hold my position. "Still true?" and "no claim" are model verdicts, and B's demo got one wrong (the jsonl is in the spec). Each verdict cites the lines it read, or it doesn't ship.

Smallest proof unchanged: the recurrence table over the 10 `retro.json` files and the 60 retro issues.

#### value

**The moderator's fact changes my case.** My A score rested on "would have caught 9 of 171, 0 false alarms". That number is invented, and the guard it sells already runs (`scripts/supabase-types.ts --check`, PRD 725). The business problem is not missing guards. It is lessons that never land: the KB stays silent, `generated:` omits the file, and the check fires late in `supabase.yml`.

**Skeptic:** I adopt your one-day proof as the business case. A table of "lessons that never landed" (guard exists? KB line? shift-left?) is the first thing a maintainer would pay attention to. I'm changing my mind on C. Extending `apps/omni-app/src/retro` with a recurrence step is the cheapest real win, not a duplicate. **C: Value 3→4, Fit 4→5.**

**Visionary:** I build on "one rewind, three tenses", with one condition. My "saved counter" remix only counts if every number is copied from evidence (the retro's own locked rule). Otherwise it is marketing for `offering#316` that the skeptical developers will catch on the first screen. I'm downgrading A to a proof engine, not a headline. **A: Wow 4→3, Value 5→4.**

**Craft:** I agree on grounding. Invented figures on A, B, F, G and H are a business risk as much as a craft one, because trust is the product here. I take your "nothing found" and "rejected finding" states as value states too.

**Users:** your ranking matches my split. Paul and the developers want G and H (action, prevention). The Lead Engineer and Irisa want E and B (coherence, claims). The merge has to serve both.

**Moved up: H, Fit 3→4.** The existing guard fires late. A ghost check that cites "never hand-edit `database.types.ts`" on the diff is the shift-left the fact calls for.

**G:** I keep my scores. The format holds, and only its demo content was invented.

**Revised bet:** start with C plus the Skeptic's table (lessons that never landed), shown as E's cards. G's split PRs are the only output (KB line plus `generated:` entry), and H is the forward edge. A stays as replay evidence inside each PR, not as a pitch.

#### users

**F-E Developer.** Skeptic, you're right, and it makes my point: G invented two files to delete, and B flagged a jsonl the spec claims three times. That is slop dressed as a finding (persona:F-E Developer). G drops 3/3/4/2 → 1/1/2/1, B Value 5 → 3, and I adopt Skeptic's two-signal rule before anything says DELETE. A Value 5 → 3, since the guard already fired. H stays my top pick, but as Skeptic's shift-left: `supabase-types --check` before push, with no staged agent debate. **Top 2: H, E**, because E only uses real `kb status` numbers.

**B-E DEv.** Visionary, a tool whose demo invents files is the gimmick I expected (persona:B-E DEv). G drops 5/5/5/5 → 2/2/3/2. Skeptic's remix of A, replaying the lesson rather than the guard, is something I'd run myself. Craft, I agree E's data beats its costume. **Top 2: A (shift-left), E (as `omni kb cracked`)**.

**Paul - Product Manager.** The moderator's fact changes my math. The reds came from a lesson that never reached the KB, so the thing that saves my time is the KB line plus a `generated:` entry, not another PR to review (persona:Paul - Product Manager). G drops 5/4/4/5 → 2/2/3/2. E Value 3 → 4. **Top 2: H, E**.

**Lead Engineer.** Moderator and Skeptic, this confirms my pick: the retro proposed the lesson twice, and the KB still has no such rule. That is exactly the cohesion gap I watch (persona:Lead Engineer). E stays top, as Visionary's continuous surface. B Value 5 → 4 until it uses Skeptic's two-signal rule and Craft's territory-table anchor. **Top 2: E, B**, unchanged.

**Irisa.** Craft, yes: B as a tab on my PRD page, in the reading style, is where I'd look (persona:Irisa). Value critic, no: keeping my planet's wound open on a model's guess that code is unneeded blocks a customer quick win over a row Skeptic showed was false (persona:Irisa). B Fit stays 5 and Value 5 → 4. **Top 2: B, E**, unchanged.

**Panel shift:** G loses every vote; E is the one concept all five keep (persona:Lead Engineer, persona:Irisa).

Moderator-verified fact relayed before turn 2: scripts/supabase-types.ts --check runs in supabase.yml; generated: omits database.types.ts; no KB line forbids hand-editing it.

## Round 1 — the person's answer

Follow the convergence: keep C E G H as one direction ("lessons that never landed"), merge A→G and B into a dossier tab, kill D F; prototype it with 1–2 alternatives.

## Round 2 — debate

### Turn 1 (open, Feasibility scored)

#### visionary

## X: Lessons that never landed

**Five moments to prototype:**
1. **The echo (1628's retro).** The `recommend` step posts "Seen before: 1322, #1349. Proposed twice. Rules: 0. `generated:` entries: 0."
2. **The card (`/knowledge`).** Five states, one of them **never landed**. The card reads "Regenerate database types, never hand-edit", with 2 retros, 0 rules and **Land it**.
3. **The landing PR (one per kind).** It changes two lines: a KB rule and `database.types.ts` added to `generated:`. Its body is the replay: links to the real red runs on 1322 and 1628 s1 that a shift-left would have stopped.
4. **Rewind tab (`/prd/1904?tab=rewind`).** Claims sit next to the merged code, with red and review rows under each claim. Unclaimed code arrives as a *question*, never a deletion.
5. **The ghost graduates.** 1911 s2 touches a migration, and its check says "landed lesson: regenerate types". The agent concedes through `omni care reply`, and the PRD page says "1 red avoided". On the second hit, the ghost opens the PR that moves the check into `check:changed`, and the card turns **shining**.

**The wow it must land:** in one take, a lesson travels from two retros to a rule, then a ghost, then a hook, and its card goes from *never landed* to *shining*.

**The four priorities:**
1. **KB drift:** the card states.
2. **Why red:** the echo and the replay links.
3. **Why a human review:** `recommend` also clusters human review threads by *what the agent missed*. A cluster that repeats becomes a never-landed card addressed to the missing `review` form, and pr-care's ghost pre-answers it next time. 1628 had 0 threads: show that empty state; take a real example from pr-stats.
4. **Is the code required:** the Rewind tab, which asks.

## Alternative: THE WARRANT
**Axis:** it starts from the code inventory, not from incidents. Every file on main needs a warrant: a spec claim, a law or a settled decision. Code with no warrant becomes questions to its owner, and a law with no code becomes drift. **Wow:** "Everything on main nobody asked for, and every law no code obeys." It leads on priorities 4 and 1, where X leads on 2 and 3.

## Scores for X
Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3. Claim mapping and the ghost trigger are new.

**Stance:** build X, with the Warrant beside it to test whether priority 4 should lead.

#### craft

## 1 · X: what the prototype must show

**Screens, and where each lands:**
1. **Retro tab** (`prd-dossier`, `?tab=retro`): C's lanes, plus a recommendation: *seen before in 1322 · never landed · to ci form*.
2. **Rewind tab** (`prd-dossier`, after Retro): B's claim map. A file with no claim gets a question, never a deletion.
3. **`/knowledge`** (no library screen, inside `app-shell`): E's states as filters: shining, cracked, unsworn, unseen, **never landed** (proposed by ≥ 2 retros, nothing merged).
4. **PR body** (GitHub) and the **PR care** tab: G's split PRs. Each hunk shows its source and A's replay receipt, with accept/drop per hunk.
5. **Check and review comment** (GitHub) and the `notifications` bell: H's ghost, plus an uncounted "Lessons to land" group, as Business already has.

**Tokens:** Ask tokens, shot in Omni, Light and Dark. Atkinson at 17/1.6. Mono only for paths, shas and run ids. No Anton, and Press Start in the wordmark only. Galaxy colours as signals only. Prose in the 900 px column.

**The one motion:** on the Retro tab, the playhead slides back once, ease-out, from SHIPPED to the lesson's first occurrence. After that, ←/→ steps event to event. Under reduced motion it is static.

**States:**
- *Before merge:* "The rewind runs when the feature PR merges."
- *Nothing found:* "11 criteria, 14 files read: every file has a claim."
- *Old spec:* "This spec numbers no criteria, so the rewind asks."
- *Rejected:* a greyed KB line "kept on purpose · dropped by @x on #n · not proposed again".
- *Ghost clean:* `anti-loop · no ghost on this diff`.
- *Landed:* the lesson leaves "never landed", and the bell group empties.

## 2 · Alternative: **Forewarned**
Wow: I open `/omni:plan` for PRD 1911. Each slice touching `supabase/migrations/` already carries "1322 and 1628 went red here, so run `supabase-types --check` first".
Axis: X lands lessons *in the knowledge base*, where a person curates them. Forewarned lands them *in the next PRD's plan and slice briefs*, keyed by territory.

## 3 · Scores for X
`Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3`
Feasibility is the weak score: judging whether a sentence is still true and mapping claims to code are model judgements nobody has built.
**Stance:** carry X on existing screens only. Judge the prototype by its states, not its hero.

#### skeptic

## X "Lessons that never landed"

**What must be true:**
- Recurrences match on the **cause** (the `ci-logs` tail plus paths), not the key. `repeated-red:check` matches unrelated reds, and `territory:s1` is local to one PRD.
- There is enough history. Only 10 of 171 shipped PRDs have a retro, so backfilling retros is a prerequisite, at one model narration per PRD.
- "Landed" has a test: a KB line, a `generated:` entry or a guard names the lesson's paths.

**Cost:** C recommend step S–M (ADR-0039 already lists the issues). G split PRs M (reuses the harvest PR path). H as a hook S per lesson. E states M. B Rewind tab L (model verdicts that cite lines). A replay L (old trees, a database per PRD): defer.

**The wedge is C + G on types drift:** "1322 #1349 ↔ 1628 #1649: guard exists, no KB line, not in `generated:`". One PR. Everything else reads this ledger.

**What the prototype may show** (real, from the 10 `retro.md` files):
1. **Types drift.** 1322 F1: 7 red commits over 3 slices. 1628 F1: 3 reds. The guard exists (PRD 725), but no KB rule does.
2. **Territory breach**, in 8 of 10 retros (0100, 0144, 0160, 0261, 0324, 1089, 1322, 1628). Often docs, READMEs and tests: 1628 s1 and s5, 1089 s8. Only partly landed (`plan/SKILL.md:157`).
3. **Outbox notes dropped.** 0100 F3–F13 and 0142 F1–F5.
4. **Migration order**, 0100 F1 (#178). It landed as `scripts/migration-order.ts` (#1457), but through an incident, not the retro. This is the control case.
5. **Line churn across slices**, in 8 of 10 retros. Shown as "dismissed: the rule may be noise".

**What it must not pretend:** no "would have caught N", no saved counters, no "since landed".

## Alternative Y: "The Fix Carries Its Lesson"
- **Direction:** forward and inline, with no rewind. A commit that turns a red green, or resolves a human review thread, must also touch a KB line, a guard or `generated:`. Otherwise `omni check coverage` asks why on that PR.
- **Wow:** "The PR that fixed the second red already carried the rule. No retro had to notice."
- **Axis:** lessons land at the moment of pain, written by the agent that has the context. The cost is friction on every fix.

## Scores for X
Wow 4 · Value 5 · Craft 3 · Fit 5 · **Feasibility 3** (the C+G wedge alone: 4)

**Stance:** build the wedge on types drift. Make the retro backfill an explicit prerequisite. A and B wait until the ledger shows recurrences beyond the ones we know.

#### value

## X: Lessons that never landed

**The one measure: the recurrence rate.** It is the share of retro findings whose cause already appeared in an earlier PRD's retro. It is computed from what the retro already writes (`retro.json`, the `omni:retro` issues, P-PRODUCT-16's stable identity), so it is copied, never estimated. The baseline is the one pair the evidence holds: 1322's issue and 1628's #1649, the same cause. In 1628 it cost "3 red · checks" on s1 although a guard existed since PRD 725. Success means the rate falls toward 0.

Each group also shows three yes/no checks from the repository: guard, KB line, shift-left. There are no hours or cost figures: those would be invented.

**Who sees it, and where:**
- **Maintainer:** on `/knowledge` (the "never landed" count) and in each split PR's replay proof.
- **Lead Engineer:** on `/app/engineering`, one tile beside `NeedsFixRate`.
- **PM (Paul, Irisa):** on the dossier's Rewind tab, phrased as a question.

**What changes for `offering#316`:** the hosted app gains a claim that is visible there: "the loop stops repeating its mistakes", shown as one falling rate. It speaks to the skeptical developers (persona:F-E Developer, persona:B-E DEv) in evidence. I make no claim about `rival#44`; the sheet holds none.

## Alternative Y: Review-first, "The thread that taught"

- **Axis:** it starts from human review threads, not from reds or drift. Priority 3 went unanswered, and the review form is missing, even though `/omni:pr-care` judges by it.
- **Wow:** "My review threads became `review.md`'s first rules. On the next PRD the agent fixed it before I looked."
- **Measure:** human review rounds per feature PR, from `pull_request_reviews`.

## Scores for X

Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 4

- **Feasibility 4** because the retro, `kb status`, `/omni:pr-care` and the split-PR flow already exist. The claim map and the hook graduation are the costly parts.
- **Stance:** back X, gated on the recurrence rate being visible from day one. Ship the Skeptic's table first.
- **Claims cited:** `offering#316`, `rival#44`.

#### users

**X = Lessons that never landed.** Scores are Wow / Value / Craft / Fit / Feasibility.

| persona | where I meet X first | W/V/C/F/Fe | stance |
|---|---|---|---|
| F-E Developer | **PR**: the ghost check, mid-review, before merge (persona:F-E Developer). | 4/5/4/4/4 | for — it catches the bug before production and deletes nothing. |
| B-E DEv | **Terminal**: the ghost check graduated into a pre-push hook (persona:B-E DEv). | 3/4/4/4/4 | for the hook and the split PRs with replay proof; /knowledge states are still fluff to me. |
| Paul - Product Manager | **PR**: split PRs that land a lesson, each small enough to approve before planning (persona:Paul - Product Manager). | 4/4/4/4/3 | for — if the split PRs don't pile up into a second review queue. |
| Lead Engineer | **/knowledge**: the "never landed" state: lessons proposed twice, still not in the KB (persona:Lead Engineer). | 5/5/4/5/4 | strongly for — this is the cohesion gap, made visible. |
| Irisa | **Dossier tab on my phone**: Rewind on my PRD, claims asked in plain words (persona:Irisa). | 3/3/4/3/4 | neutral — most of X lands on surfaces I don't open. |

**Worst fit: Irisa.**
objection (persona:Irisa): I push customer quick wins, and four of X's five parts (retro step, KB states, split PRs, hook) are technical harness I don't master (persona:Irisa). The Rewind tab is the only part I'd read, and if it asks me "is this code required?" about files, I can't answer it (persona:Irisa).

### Alternative to prototype beside X: **THE SILENT LOOP**
- **Wow:** "On Monday I noticed 1628's kind of red had simply stopped happening. The only trace was one line at `git push`: *regenerated database.types.ts — lesson from 1322, 1628*." (persona:F-E Developer, persona:B-E DEv)
- **Axis:** no new screen and no reading surface: every landed lesson is enforced where work happens — a pre-push or pre-commit hook, a `check:changed` step, a `generated:` entry. People see one weekly line per PRD ("2 reds avoided"). X *shows* the lessons; this one *hides* them in tooling.
- **Why the personas want it:** developers get a tool without costume (persona:B-E DEv). Irisa and Paul get faster PRDs without reading harness (persona:Irisa, persona:Paul - Product Manager). The Lead Engineer learns whether invisible enforcement beats a visible KB state (persona:Lead Engineer).

### Converge (moderator)

Three directions to prototype: X Lessons That Never Landed (main; C E G H, A inside G, B as dossier tab; priority 3 via review clusters = Value's 'thread that taught'); Y The Warrant (Visionary's alternative; leads on priorities 4 then 1); Z The Fix Carries Its Lesson (merges the personas' Silent Loop, Craft's Forewarned, the Skeptic's alternative). Full brief: r2/directions.md.

### Prototypes

X.html, Y.html, Z.html built by three prototypers from r2/directions.md; word pass clean on each (data shown as data-content).

### Turn 2 (the prototypes scored)

#### visionary

### X: Lessons That Never Landed
**Reaction:** the Echo row works: *Seen before 1322 · Proposed twice · KB rules 0 · generated: no · Guard yes since PRD 725*. I'd screenshot it. But the wow (*never landed → shining*) is spread over five screens, so no single frame shows the loop learning.
**Remix:** the `/knowledge` card carries its own journey strip (two retros → rule → ghost → hook), and the card lights up step by step. Add Value's recurrence rate to the card's header.
Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3
**Stance:** the right spine, but its wow needs one frame.

### Y: The Warrant
**Reaction:** it is rigorous, with real file counts. The best moment is not the map but **"1 guard with no rule"**: the inverse sweep finds the types lesson *without reading a single retro*. The map itself is a progress bar, and I wouldn't send it. Reading 1,736 files by model is costly.
**Remix:** drop the map. Keep the inverse sweep (a guard with no rule, a rule with no Governs) as X's second detector. It fixes the Skeptic's 10-of-171 problem: no retro needed.
Wow 3 · Value 4 · Craft 4 · Fit 4 · Feasibility 2
**Stance:** don't crown it. Graft its inverse sweep and its file-warrant chain.

### Z: The Fix Carries Its Lesson
**Reaction:** this is the wow of the round. "This fix turned `supabase / check` green. Which lesson does it carry?" sits right on the PR. It is the first screen I'd send. Screen 2 answers priority 3 better than anything so far: a resolved human thread writes the first line of the missing `review.md`. But it only looks forward. It can't see the past, drift or unneeded code.
**Remix:** a *No lesson* answer goes to X's card as *never landed · declined at the fix*.
Wow 5 · Value 5 · Craft 5 · Fit 4 · Feasibility 4
**Stance:** the forward half of the winner.

### Crown
I crown **X with Z grafted on as its forward edge**: lessons land at the fix (Z), and the rewind catches the ones that slipped (X). Z's `omni / lesson` check and Forewarned replace X's step 5 ghost, which is better and cheaper. Y adds its inverse sweep and its warrant chain.

**By name:**
- **Users (Silent Loop):** silence alone loses the Lead Engineer's top pick, visibility. The card stays as the receipt.
- **Skeptic:** Z's friction is one remembered click, cheaper than X's backfill.
- **Craft:** your Forewarned (Z3) earns a place in the crown.
- **Value:** your review-first alternative is now Z's screen 2.

#### craft

Shots: `r2/panel/shots-craft/`. All three use Ask tokens, Atkinson, mono for data only, and GitHub drawn as GitHub. The costume objection is closed.

### X Lessons That Never Landed
It has the most states: before merge, *kept on purpose*, `Without a claim 0`, and an empty review lane reading `0 threads`. Two faults: the Retro tab draws 1322's "first seen" (Oct 9) on 1628's Oct 11 axis with no break, so two PRDs share one timeline. And the Rewind rows number `1, 2, §1, 4`, which reads like a bug.
**Remix:** give the first occurrence its own lane behind a `⋯ 2 PRDs earlier` break. Drop step 5's `1 red avoided (example)`: the card turning *shining* is the real payoff. **Visionary**, even labelled as an example, that is the saved counter the directions refused.
`Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3`
Stance: the main direction.

### Y The Warrant
The data is honest (real `git ls-files` counts, the reading pass marked as an example). The question queue is the best interaction of the round: Delete is disabled with its reason, "Imported by 5 files". Its motion is a generic row-by-row count-up, and its bars run ahead of their numbers. The 1904 tab bar leaves `prd-dossier`'s order.
**Remix:** fold the per-PRD Warrant into X's Rewind tab, and keep only *Laws without code* and the queue on `/knowledge`.
`Wow 3 · Value 4 · Craft 4 · Fit 3 · Feasibility 3`
Stance: an organ of X (priority 4), not a rival.

### Z The Fix Carries Its Lesson
It has the best GitHub fidelity: `omni / lesson` reads as a real check with `Action required`, the agent's pick comes preselected, and `No lesson` is an honest exit. Every state is drawn. Two faults: screen 4 is a blank terminal until you press Run, a dead state at rest, and screen 5's `LESSONS THIS WEEK` is a stat strip in the header.
**Remix:** a carried lesson lands straight on X's `/knowledge` card as *landed*, so X's rewind is left only for the 161 PRDs that have no retro.
`Wow 4 · Value 4 · Craft 4 · Fit 4 · Feasibility 4`
Stance: the cheapest stop to recurrence; pair it with X.

### By name
- **Value:** I keep X's Feasibility at 3. The claim map and cause matching are unbuilt.
- **Skeptic:** Z is your C+G wedge moved to the moment of pain, at the cost of one radio and one commit.
- **Users / Irisa:** Y's queue is the only screen that asks in plain words, so fold it into the Rewind tab.

#### skeptic

I checked every number shown as real against the repo. Everything holds except what I flag.

### X Lessons That Never Landed
Best grounded. These hold: #1629's times, 1322's s2/s3/s7, the run ids, and every 1904 path.
Flags:
- "Files read 46" has no source; the diff has 52 files.
- The migration rule sits at line 12 of the briefing, not 25.
- "All 10 red runs" adds 1322's 7 *commits* to 1628's 3 *runs*.

Remix: drop "1 red avoided (example)". No one can ever measure it. Show "ghost hits 2 · reds on this check since landed: 0".
Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3
Stance: right direction; the Rewind tab is its costly part.

### Y The Warrant
Surprisingly honest. Real: the `hook.ts` chain (PRD 71 line 83, #73, N-PRODUCT-7 locked 2026-10-13 with its Governs), `calendar.ts` (`32b4f09b`, no PR, 5 importers) and the 52 files. Only "1,736 source files" has no basis (`git ls-files`: 4,756). Its accidental best find: `CALENDAR` is in fallow's dead-code baseline while 5 files import it, so the baseline itself has drifted.

Remix: ship only the deterministic path pass (Governs plus territories). Every owner here is @pierrederval, so "one owner each" means one person. Cap it at 3 questions a week.
Wow 4 · Value 4 · Craft 4 · Fit 4 · Feasibility 2
Stance: a weekly sweep for priority 4, not a product.

### Z The Fix Carries Its Lesson
Real anchors:
- the `supabase / check` job name;
- `ci.md` 76–77, the empty Known-reds slot;
- the fallow step in `check-changed-steps.ts`;
- "8 of 10 retros".

Its PRs are labelled examples. Its triggers are deterministic: a check that goes red then green, and a thread a person resolves. That makes it the cheapest of the three.

Remix: before asking, search the KB for a line on that path. If one exists, ask "why didn't it hold?" instead of drafting a duplicate. X's ledger becomes Z's memory.
Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 4
Stance: the wedge. X's card shows what Z lands.

### To the others
- **Value:** a recurrence *rate* over 10 retros is one pair. Your Feasibility 4 ignores the backfill. Show counts until the backfill is done.
- **Visionary, Users:** "1 red avoided" and "2 reds avoided" are the counterfactuals the person banned.
- **Irisa:** you're right. File questions go to the slice's agent or owner. The PM sees claims only.
- **Craft:** Forewarned is Z's screen 3. Agreed.

#### value

My measure stays the **recurrence rate**: findings whose cause appeared in an earlier retro. Baseline: types drift, 1322 (#1349) and 1628 (#1649).

### X Lessons That Never Landed
Reaction: the value sits in the Card and the Landing PR. A two-hunk PR (KB line plus a `generated:` entry), sourced to two retros, is the cheapest proof a skeptic can merge. X proves the backlog side of the rate: the never-landed count falls.
Remix: yes, and drop "1 red avoided (example)" until a ledger measures it.
Scores: Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3
Stance: the main direction. The Card and the Landing PR ship first, the Rewind tab last.
Claims: `offering#316`

### Y The Warrant
Reaction: the craft is strong, and its "guard with no rule" row is the types lesson seen from the other side. But it leads on priority 4, which the person ranked last. Its measure (share of warranted files) moves neither reds nor review rounds.
Remix: yes, and keep only its inverse sweep as a feeder for X's never-landed and unseen cards.
Scores: Wow 4 · Value 3 · Craft 4 · Fit 3 · Feasibility 3
Stance: a later sweep, not the lead. **Visionary**, I disagree: the person already ordered the priorities, so Y need not test that.

### Z The Fix Carries Its Lesson
Reaction: this one bends the rate forward. The agent that made the fix writes the lesson, so no new never-landed lesson piles up. It alone answers priority 3, by seeding the missing `review` form from a resolved thread. The risk is an "Action required" check on every fix, which reads as friction (persona:B-E DEv).
Remix: yes, and Z's "Carried / Kept on purpose / No lesson" answers feed X's card states.
Scores: Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 4
Stance: merge it into X as the forward half, not as a rival.

**Craft, Skeptic:** I'm changing my mind. My feasibility of 4 for X was generous: the "still true?" judgement and claim mapping are unbuilt, so X moves to 3. Z keeps 4 because it reuses checks that already run.

**Overall:** X plus Z gives one rate, falling from both ends. For `offering#316`, the claim is "the loop stops repeating itself".

#### users

### X Lessons That Never Landed
| persona | reaction | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | Two sourced hunks, "no claim found · ask": nothing deleted. | 4/5/5/4/4 | for |
| persona:B-E DEv | The PR and the hook are real; the /knowledge page I won't open. | 3/4/4/3/4 | for the PR only |
| persona:Paul - Product Manager | Echo → card → PR: three stops before anything lands. | 4/4/4/3/3 | lukewarm |
| persona:Lead Engineer | Migration order shining beside types drift never landed: the view I lacked. | 5/5/5/5/4 | strongly for |
| persona:Irisa | The Rewind tab reads fine; the rest is lanes and configs. | 3/3/4/2/4 | neutral |

objection (persona:Irisa): Five screens of harness, and none tells me whether a customer got something faster (persona:Irisa).
fits persona:F-E Developer ✓ · persona:B-E DEv ✓ · persona:Paul - Product Manager ✓ · persona:Lead Engineer ✓ · persona:Irisa ✗ · offering#316 ✓

### Y The Warrant
| persona | reaction | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | "Why is this file on main?" asked, never deleted. Honest. | 4/4/4/3/3 | mild for |
| persona:B-E DEv | I'd query the warrant chain; the owner queue is homework. | 4/3/4/3/3 | neutral |
| persona:Paul - Product Manager | Cleaning the past gives my next feature nothing. | 3/2/4/1/3 | against |
| persona:Lead Engineer | Every file warranted or questioned, one owner each: cohesion, if owners answer. | 4/4/4/4/3 | for, second |
| persona:Irisa | File paths end to end. | 2/2/4/1/3 | against |

objection (persona:Irisa): I don't master the harness, and Y is a repository inventory with nothing a customer sees (persona:Irisa).
fits persona:F-E Developer ✓ · persona:B-E DEv ✓ · persona:Paul - Product Manager ✗ · persona:Lead Engineer ✓ · persona:Irisa ✗ · offering#316 ✗

### Z The Fix Carries Its Lesson
| persona | reaction | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | The lesson is written in the PR where I fixed the red, while I still have the context. | 5/5/4/5/4 | for — the KB line stays a reviewable hunk |
| persona:B-E DEv | One line at `git push`, no page. That's the tool I asked for. | 5/4/4/5/4 | strongly for — if "No lesson" is one click |
| persona:Paul - Product Manager | Forewarned in `/omni:plan`: the red never happens in my next PRD. | 5/5/4/5/4 | strongly for |
| persona:Lead Engineer | Agents writing KB lines inside fixes, with no view of the whole, erodes cohesion. | 4/4/4/3/4 | for, needs X's view |
| persona:Irisa | I read nothing; my PRD page says what was learned. | 4/4/4/4/4 | for |

objection (persona:Lead Engineer): I keep teams coherent from the board, and Z scatters lessons across fix PRs with no place showing what never landed (persona:Lead Engineer).
fits persona:F-E Developer ✓ · persona:B-E DEv ✓ · persona:Paul - Product Manager ✓ · persona:Lead Engineer ✗ · persona:Irisa ✓ · offering#316 ✓

### Picks
- persona:F-E Developer **Z**: the lesson lands where I fixed it.
- persona:B-E DEv **Z**: silent, no page.
- persona:Paul - Product Manager **Z**: Forewarned speeds up the next PRD.
- persona:Lead Engineer **X**: the only overview. I'd take Z feeding X's cards.
- persona:Irisa **Z**: nothing to read.

## Round 2 — the person's answer

Another round: merge X+Z(+Y) into one prototype and show it before crowning.

## Round 3 — debate

### Turn 1 (converge on the moderator's draft, r3/direction.md)

#### visionary

**Name:** keep **The Anti-Loop**: the brief's own word. Call the screen **Lessons**.

**One-frame wow:** make the frame *the card itself*, not two surfaces side by side. Its journey strip runs 1322 red ×7 → 1628 red ×3 → echo (#1349 ↔ #1649) → fix commit on the PR → hook. The one authored motion is the last node lighting and the card flipping from *never landed* to *shining*. Draw a second card beside it, from a review thread that became a line of `review.md` (Value's review-first idea). Both entrances and priority 3, one frame.

**Cut:**
- Silent as its own screen: it becomes the strip's last node (Users).
- Y's full warrant chain on the Rewind tab: too heavy. Keep only its questions (Irisa sees claims only).

**Check before rendering:** `game/calendar.ts` is in fallow's dead-code baseline, yet five files import it. Skeptic, verify that before we show it as a question: a wrong question costs trust.

**Add:** the "why didn't it hold?" ask (Skeptic) as a drawn state on the card: *cracked · a rule existed*.

#### craft

**Screen order**:
1. Fix PR (GitHub check `omni / lesson`).
2. `/knowledge` › Lessons. Needs a draft screen in `app-shell`.
3. Retro tab (`prd-dossier ?tab=retro`).
4. Rewind tab (`prd-dossier`, after Retro), holding the question queue.
5. One terminal frame: Forewarned, plus the hook line, with the output visible at rest.

**Cut:** the weekly sweep as a screen of its own. Its findings become cards on `/knowledge` (*guard with no rule*, *no Governs*, *no warrant*). Header counts move into the filter chips.

**The one motion:** the card flip on screen 2, from *never landed* to *shining*, with the journey strip filling one step. Drop X's playhead slide. Under reduced motion it is instant.

**States that must be drawn:**
- *No lesson* chosen.
- *A line exists, so why didn't it hold?*
- `/knowledge` with nothing never landed.
- *Kept on purpose.*
- Rewind before merge.
- Rewind with nothing to ask (1904: 0 questions).
- An old spec with no numbered criteria.
- Retro with 0 review threads.

#### skeptic

**Wrong in the draft:**
- **"Silent" can't regenerate the types in pre-commit.** `scripts/supabase-types.ts` needs a running local database. The hook can only *check*, when `supabase/migrations/` changed and the database is up, and it must say so when the database is down.
- **The wow frame overclaims.** A landed KB line arrives `Proposed`, which is *unsworn*. It turns *shining* only when it has an `Enforced by:` test and a person locks it. Show two flips: never landed → unsworn → shining.
- **The pairing is crossed.** "1628 F1 ↔ 1322 F1 (#1349 ↔ #1649)": 1628's issue is #1649.
- **`calendar.ts` is not unwarranted code.** Five files import it. What fallow lists is an unused *export*, so it belongs under "baseline drifted", not "file nothing warrants".

**Cut for now:** the Rewind tab's claim map. Costly model judgement; show it as a later state.

**Wedge:** Z's red→green ask, with the KB search for duplicates, plus one landing PR for types drift (a ci.md Known-reds line and a `generated:` entry).

**Must be true:** "No lesson" costs one click, and that answer is remembered.

#### value

**Measure: counts, not a rate.** Ten retros cannot carry a rate.

**`/knowledge` › Lessons header, all copied from evidence:**
- **Never landed 3:** types drift, territory, outbox notes.
- **Landed 1:** migration order, via an incident.
- **Kept on purpose 1:** churn.
- **Read 10 of 171 retros:** the denominator, said out loud.

**On each card:** "proposed by N retros" (2, 8, 2) and its sources.

**At the wow:** "Never landed 3 → 2" ticks once as the card turns shining. Label it "(example)".

**Same count, two more places:**
- one tile on `/app/engineering`, for the Lead Engineer;
- one line on the Rewind tab: "lessons this PRD repeated: 1".

**Change:** make `omni / lesson` a **neutral** check, never "Action required". A blocking ask on every fix is the friction persona:B-E DEv walks away from, and it costs `offering#316` its adoption story.

#### users

- **persona:F-E Developer**: the lesson as a visible hunk in the fix PR's diff that a person reviews, never a commit the agent slips in after green.
- **persona:B-E DEv**: the silent pre-commit line at rest in a real terminal frame, and "No lesson" as one click that is never asked again.
- **persona:Paul - Product Manager**: Forewarned in `/omni:plan`, so the next PRD's slice is warned before it goes red, with no extra PR in my queue.
- **persona:Lead Engineer**: the `/knowledge` › Lessons card flipping from *never landed* to *shining* from the fix PR's answer, so forward lessons and rewind lessons sit in one ledger.
- **persona:Irisa**: the Rewind tab on a phone, showing claims only, in plain words, each one kept or questioned, with no file paths.

objection (persona:Irisa): with "1 red avoided" ruled out, nothing in the merged direction tells me, a customer-first PM, what my PRD gained; the only part I'd open is a claims list (persona:Irisa). Give me one plain line on my dossier, such as "lesson carried: regenerate types", rather than a counterfactual (persona:Irisa).

Moderator verified: scripts/supabase-types.ts runs supabase gen types --local (needs a running local database), so a pre-commit hook can only check. Final direction: r3/direction.md › FINAL.

### The merged prototype

r3/anti-loop.html, rendered by the X prototyper from r3/direction.md › FINAL; word pass clean. Prototyper notes: break reads "⋯ earlier · PRD 1322"; calendar.ts is not drifted (a question to recheck); the check is named `check`; the hook, Forewarned and omni / lesson are proposals.

### Turn 2 (the merge scored)

#### visionary

**Does the one-frame wow land?** Almost. The hero card's strip (1322 red on 7 commits → 1628 red on 3 → Echo #1349 ↔ #1649 → Fix PR lesson hunk → Before CI) is the screenshot I asked for. The two flips, *never landed → unsworn → shining (a person locks it)*, are more honest than my single flip and lose no wow. But the prototype opens on screen 1, a neutral check row on a light GitHub page. Correct, quiet, unforwardable. The wow sits one click deep.

**Remix:** make **Lessons** the opening frame and the hub. The prototype opens on the hero card, mid-strip. Each node on the strip opens its screen: *Fix PR* opens screen 1, *Echo* opens the Retro tab, *Before CI* opens the terminal. The five screens become the card's evidence, not a slideshow.

Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3. `omni / lesson`, Forewarned and the hook are new.

**Stance:** crown it, with Lessons first. All four priorities answered, every figure real or labelled.

#### craft

Shots: `r3/panel/shots/` (Omni, Light, Dark, 393 px).

**States:** all drawn, with output visible at rest: asking / no lesson / a rule existed, kept on purpose, 1322's own lane behind a break, "0 human review threads", nothing to ask, old spec, before merge, database down, nothing changed.

**Motion:** one flip, with reduced motion handled. Delete X's leftover playhead CSS (`transition:left 1.7s`).

**Tokens:** Ask tokens in all three themes, with GitHub drawn as GitHub.

**Faults:**
- At 393 px, step 2 overflows to the right: chips, hero title and facts grid are clipped.
- The shining card reads "KB line · Proposed" beside "Locked".
- The journey strip and the facts grid say the same thing twice.

**Remix:** make the strip's nodes the facts. Each node opens to its proof (`ci.md` line, `Enforced by:` test, lock), and the grid goes.

`Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 4`
Feasibility moves 3→4: the claim map is deferred, and the check is neutral.

**Stance:** crown it, once the phone overflow and the Proposed/Locked contradiction are fixed, before the screens are drafted into the library.

#### skeptic

**Still wrong:**
- **The lesson hunk breaks territory.** It sits in a slice PR (`omni:slice`) that edits `ci.md` and `config.yml`, outside the slice's territory. That repeats lesson #2, which the prototype lists itself. Send the hunk to a sibling `omni:lesson` PR, or declare it shared ground.
- "26 commits": #1629 has 19 (`gh`).
- "52 files · 0 questions" is 1904's count but shows on 1628's page. Label it as 1904.
- The `config.yml` hunk is one line off: `build:` sits at line 64.

Correct: 10 criteria, 6 PRs · 0 reviews, 1322 first seen in s2, 8 runs · 3 red, s1 README, s5 guide plus tests, 8 retros, read 10 of 171.

**Wedge:** the `omni / lesson` ask on red→green, with the KB lookup for duplicates, plus one landing PR for types drift. Next comes the `recommend` step. The Lessons screen reads the ledger these write.

**Remix:** make "Why didn't it hold?" (Not read / Unclear / No check before CI) the ledger's key. Each answer routes to a different fix: briefing, rewording, or a hook.

Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3

**Stance:** crown it, scoped to the wedge. The claim map stays "coming".

#### value

**Counts: truthful.**
- "Sweep read 10 of 171 retros" ✓
- 3 never landed (types, territory, outbox) ✓
- 1 shining (migration order, via incident) ✓
- churn kept on purpose ✓
- invented items are marked "(example)" ✓

Gaps: the types card lacks its "2 retros" label. And the fix PR shows both "no line" and "A rule existed (example)"; split them. The `/app/engineering` tile is missing too. The flip to *unsworn*, not shining, is honest.

**Business:** `offering#316` gains a visible proof that the loop learns, made only of copied counts. The neutral `omni / lesson` check removes the friction risk (persona:B-E DEv).

**Remix:** the Rewind tab's "Lesson repeated" line also posts on the feature PR, so the PM sees it before merging.

Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3

**Stance:** crown it.

#### users

| persona | did I see what I asked for? | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | Yes. "Carried as a hunk · a person reviews" with Accept/Drop per hunk, and `omni / lesson` is neutral and never blocks. | 5/5/5/5/4 | for, my pick |
| persona:B-E DEv | Mostly. The terminal shows the hook's lines at rest and "No lesson · remembered for this path" is one click, but the silent case (nothing changed, no output) isn't drawn. | 4/4/4/5/4 | for. Draw the silence. |
| persona:Paul - Product Manager | Yes. Forewarned on s1 in `/omni:plan`, and the lesson rides inside the fix PR with no extra PR. | 5/5/4/5/4 | for, my pick |
| persona:Lead Engineer | Yes. The Lessons card has its journey strip, and the second flip waits for "a person locks it". Forward and sweep cards share one ledger. | 5/5/5/5/3 | strongly for. Feasibility rests on the cause-matching. |
| persona:Irisa | Partly. "Lesson repeated: regenerate types" is the plain line I asked for, but the same tab lists `apps/galaxy/README.md` questions below my claims, and I saw no phone frame. | 4/4/4/3/4 | for, if the paths fold away |

objection (persona:Irisa): on my Rewind tab, the file questions to slice agents sit right under my claims; as a customer-first PM, I want them folded behind "for the agents" and a phone frame that proves it reads at 7am (persona:Irisa).

fits persona:F-E Developer ✓ · persona:B-E DEv ✓ · persona:Paul - Product Manager ✓ · persona:Lead Engineer ✓ · persona:Irisa ✗ (✓ once the paths fold) · offering#316 ✓

## Round 3 — the person's answer

CROWN the M _BUT_ we need to work on the "look and feel" I would like when in ANTI-LOOP mode that it switches the UX-UI in the ANTI-LOOP COLORS ( when you use omni theme ) and that even the game would haven an anti-loop game where you play the "MEAN GUY" - bad heros like the vultronites in "invicible' comics - that is important (please keep M ) but do ideation of design around the anti-loop and 'anti-heros'

Moderator: M is crowned. Before the vision tour, a design round on (1) anti-loop mode, the UI switching to anti-loop colours under the Omni theme, and (2) an anti-loop game where you play the anti-heroes. The faction is our own, inspired by the archetype (proud conquerors who expose weakness); no names, likenesses or designs from Invincible.

## Round 4 — the anti-loop look and the anti-heroes (design round after the crown)

### Cards

t-1 Rewind Light, t-2 Side B (identity artist); g-1 Breach Night · The Recurrent, g-2 The Assay · The Assayers (game artist). Word pass clean on all four.

### Turn 1

#### visionary

### t-1 Rewind Light
Tasteful, and the ∞ running backwards is a nice touch. But at a glance it is the same room dimmed; nobody forwards a palette swap.
**Remix:** the backwards ∞ runs once on entry, as the one motion.
Wow 3 · Value 3 · Craft 4 · Fit 5 · Feasibility 5
**Stance:** the fallback for Light and Dark.

### t-2 Side B
This is the screenshot: a mirrored sidebar, the strip running right to left, the hero card printed as a negative. It feels like rewinding a tape.
**Remix:** keep the mirror, the strip and the negative; drop the scanlines from reading copy.
Wow 5 · Value 3 · Craft 4 · Fit 3 · Feasibility 4
**Stance:** into the tour, without the scanlines.

### g-1 Breach Night
You *are* the Recurrent, landing on 1628 one rank higher because 1322 never learned. "We only return where you never learned" sums up the faction, and it is drawn from real retros. I'd send it.
**Remix:** make the breach real. A never-landed lesson opens a true wound (`WOUND_OPENED`), and merging the lesson closes it. The villain becomes the forcing function Value has asked for since round 1.
Wow 5 · Value 4 · Craft 4 · Fit 5 · Feasibility 3
**Stance:** this is the game.

### g-2 The Assay
Invaders reading a wall of real lessons is clever, and so is "fires blind". "Gap seals for every player" is the right payoff. But the silhouette is generic Space Invaders, and the Assayers are less vivid than the Recurrent.
**Remix:** make it a mode of Breach Night, not a cabinet of its own.
Wow 4 · Value 4 · Craft 4 · Fit 4 · Feasibility 4
**Stance:** good, but second.

### Vision tour
**t-2 Side B** (without the scanlines) and **g-1 Breach Night**. Both rewind, and in both the mean guy is the one who teaches.

#### craft

Within the person's override. None of the four adapts to 393 px yet.

### t-1 Rewind Light
Disciplined: six tokens remapped, contrast printed, one 360 ms wipe with a reduced-motion swap. But magenta is now the badge, the active chip *and* the primary, so "never landed" blurs into "Land it".
**Remix:** magenta for state only; the primary takes the yellow, the way back out.
`Wow 3 · Value 3 · Craft 5 · Fit 5 · Feasibility 5`
Stance: ship this as the mode.

### t-2 Side B
The negative card and the strip reversed (Before CI → 1322) are real ideas: the mode reads backwards. The mirrored crest, the reflected "Lessons", the scanlines and the right-hand sidebar are costume, and the sidebar costs muscle memory.
**Remix:** move the negative card and the reversed strip into t-1.
`Wow 5 · Value 2 · Craft 3 · Fit 2 · Feasibility 4`
Stance: harvest it, don't ship it.

### g-1 Breach Night
It reuses `planet-overlay`'s tabs (BREACH beside ENTROPY), the planets are honest pixel art, the facts are real, and the planet is repelled only by landing the lesson. But the slanted Anton title is HOME's ad face, and the quote is in mono where Jersey 10 belongs.
**Remix:** raids reach only *never landed* planets, so the map is the Lessons filter.
`Wow 4 · Value 4 · Craft 4 · Fit 5 · Feasibility 3`
Stance: the game pick.

### g-2 The Assay
Bunkers as lessons (held, open, kept) is the clearest mapping of the round. Same fonts fault as g-1, and it needs a whole new cabinet.
**Remix:** make it g-1's raid mini-game.
`Wow 5 · Value 3 · Craft 4 · Fit 3 · Feasibility 2`
Stance: fold it into g-1.

#### skeptic

### t-1 Rewind Light
**Must be true:** the six swapped tokens pass the `ASK` AA test in `tokens.ts`. **Rule broken:** `red` → orange #ff9b30 conflicts with "red errors only". **Cost:** S, one token variant.
**Remix:** the colours follow state, not a switch. Lessons stays in rewind colours while anything never landed, and turns back at 0.
Wow 3 · Value 3 · Craft 4 · Fit 4 · Feasibility 5
**Stance:** take it.

### t-2 Side B
Mirroring the sidebar and adding scanlines on a reading surface go against the design form. **Cost:** M, all fifteen tokens plus a layout fork.
**Remix:** keep Side B for the arcade's anti-loop cabinet only.
Wow 4 · Value 2 · Craft 3 · Fit 2 · Feasibility 3
**Stance:** not on `/app`.

### g-1 Breach Night
**Rules broken:**
- BREACH_REPELLED pays the raider. Raiding is playing, and "Playing a game never earns points or XP" (`game/README.md`:224).
- `breach` is not in `WOUND_KINDS`. It needs its rulebook entries and must not knock a terraformed planet back toward PLANET_LOST and its clawback.

**Cost:** M–L.
**Remix:** a breach is a wound like `aftershock`, and existing `woundClose` pays whoever lands the lesson. The raider earns a trophy only.
Wow 5 · Value 3 · Craft 4 · Fit 3 · Feasibility 3
**Stance:** yes, once the raider pay is removed.

### g-2 The Assay
The score is play score, which is fine. LESSON_LANDED is real work, also fine.
**Must be true:** the event fires on the merge of a lesson PR whose KB line cites its retro findings. **Cost:** M, a new event plus a source.
**Remix:** weight it at or below `aftershock`'s 20, under `featureMerged`'s 30.
Wow 4 · Value 3 · Craft 4 · Fit 4 · Feasibility 4
**Stance:** the cleanest game.

#### value

### t-1 Rewind Light
Six tokens move, so the reading surface stays readable for the Lead Engineer and Irisa. The mode signals "looking back" and keeps `offering#316`'s counts legible.
Scores: Wow 3 · Value 4 · Craft 5 · Fit 5 · Feasibility 5
Stance: ship this as the mode.

### t-2 Side B
Striking, but all fifteen tokens move under scanlines. To skeptics (persona:B-E DEv, "fluff"), the serious half looks like a toy.
Scores: Wow 5 · Value 2 · Craft 4 · Fit 3 · Feasibility 3
Stance: keep it for the game room, not the app.

### g-1 Breach Night
The only game whose win is a real merge: landing the KB line repels the warlord. Real map, real 1322/1628 facts, so play lowers the never-landed count.
Scores: Wow 5 · Value 4 · Craft 4 · Fit 5 · Feasibility 3
Stance: crown it as the game.

### g-2 The Assay
"Gap seals for every player" is a strong payoff, but the cabinet sits apart from the planets, and "4210 (example)" scores play, not learning: weaker evidence for `offering#316`.
Scores: Wow 4 · Value 3 · Craft 4 · Fit 3 · Feasibility 2
Stance: fold its wall (held/open/kept) into g-1's breach log.

#### users

### t-1 Rewind Light
| persona | reaction | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | Six tokens move; the layout stays put. | 3/4/5/5/5 | for |
| persona:B-E DEv | A colour change I can ignore. Fine. | 2/3/4/4/5 | tolerant |
| persona:Paul - Product Manager | Subtle. I'd barely notice I'm in rewind. | 3/3/4/3/5 | mild |
| persona:Lead Engineer | Same screen, a different light. | 4/4/5/5/5 | for |
| persona:Irisa | Nothing moves; I see the lessons side. | 3/4/4/5/5 | for |

objection (persona:B-E DEv): A mode is still costume; the card worked without it (persona:B-E DEv).
fits persona:F-E Developer ✓ · persona:B-E DEv ✓ · persona:Paul - Product Manager ✓ · persona:Lead Engineer ✓ · persona:Irisa ✓ · offering#316 ✓

### t-2 Side B
| persona | reaction | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | Mirrored nav and wordmark: I'd file it as a bug. | 5/2/4/2/4 | against |
| persona:B-E DEv | This is the gimmick I predicted. | 3/1/4/1/4 | against |
| persona:Paul - Product Manager | A different product. Great demo. | 5/3/4/4/4 | for |
| persona:Lead Engineer | Navigation switching sides breaks team habits. | 4/2/4/2/4 | against |
| persona:Irisa | The menu jumping sides loses me. | 4/2/3/1/4 | against |

objection (persona:Irisa): I don't master the harness, and Side B moves the one thing I'd learned: where the menu is (persona:Irisa).
fits persona:F-E Developer ✗ · persona:B-E DEv ✗ · persona:Paul - Product Manager ✓ · persona:Lead Engineer ✗ · persona:Irisa ✗ · offering#316 ✗

### g-1 Breach Night (The Recurrent)
| persona | reaction | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | Real facts; defenders win only by landing the lesson. | 4/3/4/3/4 | mild for |
| persona:B-E DEv | A warlord for a missing KB line. | 2/1/4/1/4 | against |
| persona:Paul - Product Manager | It makes the lesson stick. | 5/4/4/4/4 | for, my pick |
| persona:Lead Engineer | It attacks a cause, never a person. | 4/3/4/3/4 | neutral |
| persona:Irisa | Playable on my phone, on my planets. | 4/3/4/4/4 | for |

objection (persona:B-E DEv): Playing the villain of a types-drift finding is the fluff I expected (persona:B-E DEv).
fits persona:F-E Developer ✓ · persona:B-E DEv ✗ · persona:Paul - Product Manager ✓ · persona:Lead Engineer ✓ · persona:Irisa ✓ · offering#316 ✓

### g-2 The Assay (The Assayers)
| persona | reaction | W/V/C/F/Fe | stance |
|---|---|---|---|
| persona:F-E Developer | The wall is the Lessons ledger. | 4/4/4/4/4 | for |
| persona:B-E DEv | A game, but on real data. | 3/2/4/2/4 | least bad |
| persona:Paul - Product Manager | A cabinet I visit, not my planets. | 4/3/4/3/4 | neutral |
| persona:Lead Engineer | One shared wall, sealed by the team. | 4/4/5/5/4 | for, my pick |
| persona:Irisa | Rules, not my features. | 3/2/4/3/4 | neutral |

objection (persona:B-E DEv): I'd skip a cabinet whose score is an example number (persona:B-E DEv).
fits persona:F-E Developer ✓ · persona:B-E DEv ✗ · persona:Paul - Product Manager ✓ · persona:Lead Engineer ✓ · persona:Irisa ✓ · offering#316 ✓

### Picks (t / g)
- persona:F-E Developer: t-1 / g-2
- persona:B-E DEv: t-1 / g-2
- persona:Paul - Product Manager: t-2 / g-1
- persona:Lead Engineer: t-1 / g-2
- persona:Irisa: t-1 / g-1

## Round 4 — the person's answer

Mode: "I think Side B is 'too much' however I would keep the logo the same as omni-loop but in the other side and write OMNI LOOP write anti loop in the other side with the anti-loop records." (with a screenshot of the app bar's OMNI LOOP lockup). Game: "G1 + G2 mini-game (Recommended)".

Moderator: the tour uses Rewind Light (errors kept red) with the person's lockup, which is the same pixel mark mirrored on the other side and the wordmark reading ANTI LOOP. It also uses Breach Night with The Assay wall as its raid mini-game: the villain earns a trophy only, and a breach is a wound closed and paid on landing the lesson. Brief: vision-brief.md.

## Step 5 — the crown

**The vision tour** (vision.html): rendered by the X prototyper from vision-brief.md in eight steps: lockup, Lessons, Fix PR, Retro, Rewind, Terminal, Breach Night, The Assay. Word pass clean. The person's edit: "the circle should be with anti-loop colors". The mirrored mark's ring and arrow moved to a magenta ramp (#ffd1e8 / #ff8cc8 / #ff3ea5 / #c41f7e); the navy outline and violet shadow are kept, and the forward mark is untouched.

**The area map.** Each critic proposed six areas:
- Value: lesson-ledger first.
- Skeptic: lesson-ask first.
- Visionary: lesson-echo first.
- Craft: retro-echo first.

The moderator merged them with retro-echo as the wedge (Visionary and Craft) and kept the dissent.

The person's edit: "Merge 3 + 4": Lessons and anti-loop mode become one area, lessons-hub, so five areas remain:
1. retro-echo
2. lesson-check
3. lessons-hub
4. rewind-tab
5. breach-night
