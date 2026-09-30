# Debate — concept 746, business context every agent reads

The studio's turns, round by round and by role, dissent included. Panel: Visionary, Craft, Skeptic, Value, Sophie (user: head of product at Vertuoza), Tom (user: tech lead, new empty workspace). The moderator never voted.

## Round 1 — the moderator's send-backs

- a1-1 (Market Invade) and a1-2 (Customer in the Room) sent back: same direction as a4-1 and a4-2, shade only.
- a3-1 (Insert Cartridge: drafted from evidence, keep/skip) sent back: same direction as a4-1, shade only.
- a2-2 (Intel Dossier: invade drafts graded claims, person confirms) sent back: same direction as a4-1. Note: three of four artists went for 'agent drafts from evidence', which is a strong signal for the panel.

## Round 1 — concepts

## A (a4-1) What we believe (claims with receipts)
Wow: open a fresh workspace after one /omni:invade and it already says "We think you sell an ERP to 2–50-person builders in Belgium, up against Procore and Excel+WhatsApp. Nobody typed this." with 41 receipts.
Axis: who authors / what shape — agents write it from evidence as a stream of claims; people only veto.
Business context = living claims (ICP, region, competitors, buyer) with receipts from READMEs, pricing page, merged PRDs, customer bugs. New evidence contradicts claims (French i18n PR challenges "Belgium only" → red, one-click answers). Claims decay after 120 days without evidence. Empty until first invade; think-big quotes claim + receipt.
File: r1/a4-1.html

## B (a4-2) The customer seat
Wow: mid-think-big, "Marc, owner of an 11-person renovation firm in Liège" pushes back: "A board? My office is my kitchen table." Claude drops it.
Axis: how agents consume it — the context speaks as a participant, not data to look up.
Business stored as plain-words customers (customers/marc.md in the plan repo, reviewed by PR, or drafted by invade from support threads), not ICP/competitor fields. In think-big/brainstorm the customer takes a seat, reacts citing evidence, and runs a fit line (ICP ✓ region ✓ beats alternative ✓). Empty folder → no seat.
File: r1/a4-2.html

## C (a3-2) Fit Fight (VS screen)
Wow: think-big stages the idea as a fighting-game VS screen: the real customer (ICP as pixel character) vs a named competitor boss with its weak spot, and a fit %. Nobody told it who either was.
Axis: where the context shows up — at the moment of use, inside the agent's output, competitor-first.
Each idea a round: P1 = ICP persona and why it lands; boss = rival card with weak spot; fit %. Every fact cites its source (Business ICP, rival card); stale rival shows "verified 41 days ago — re-check?". K.O. strip spells the success test. Buttons: Next rival, Brainstorm this.
File: r1/a3-2.html

## D (a2-1) Series Bible
Wow: think-big's script supervisor caught that episode 741 was written for a 6-company holding when the lead is Marc with 12 staff: "Procore wins that fight" — offered "Rewrite for Marc".
Axis: context as person-written CANON, enforced on agents' output after the fact (in canon / breaks canon).
Each Product gets a show bible (Settings → Series bible): logline, lead character (ICP as a person), rivals with verdicts, the world (region, model), "Never" rules. Every PRD is an episode of the current season; a script-supervisor pass marks each "In canon" / "Breaks canon" with a reason and fix. Brainstorm opens with the logline. Canon changes are versioned ("CANON · v7").
File: r1/a2-1.html

## E (a3-1) New Game (business character creator)
Wow: brand-new workspace, no repos — two minutes of picking like a game character creator and every agent knew our customers and rivals. Nobody typed a letter.
Axis: the empty cold start — built by picking from presets, no evidence needed.
Settings › Business, 4-step NEW GAME: pick a trade (icon grid), customer-size two-handle pixel slider (2–50), toggle regions, choose rivals from a boss roster fitting trade+region ("+" the only typing). A character builds on the left ("Vertuoza, class: Vertical SaaS · ERP"), a one-line summary writes itself. Keyboard, "A to pick". "Skip — agents work without it". Next step: "your bets" (quarter goals).
File: r1/a3-1.html

## F (a2-2) The Interview
Wow: an agent interviewed me like a reporter for ten minutes; when I tapped "construction companies" it said "too broad to print — picture the last one who signed"; out came a one-page company profile every brainstorm now quotes.
Axis: authored through conversation — an interviewer pushes the founder to printable specificity (not form, not evidence draft, not solo canon).
From empty Settings → Business, one click starts a 10-min on-the-record interview with Dunford's positioning questions, tap answers ("Something else…", "Skip — off the record"). Pushes back on vague answers using what it sees in the repos ("38 tenants, 50-user cap — how many people?"). A newspaper-style profile writes itself on the right; highlighted facts become "agents will cite" chips. Open slots show owed questions; re-run any time.
File: r1/a2-2.html

## G (a1-1) Strategy Clock
Wow: I moved the dial from "cut churn" to "reach 50-staff firms" and the agents' next-to-build list re-sorted in front of me; two PRDs lit red because their bet expired two days ago.
Axis: time — context is dated bets that expire and re-rank what agents propose.
Per product: a quarter timeline of bets (start, end, expiry, weight) + a standing "never" line. A dial sets this quarter's mix; re-ranks what think-big/brainstorm/invade would build next (▲4 ▼3 new). Agents read only live bets (`omni bets`). Expired bet → agents pause; in-flight PRDs on dead bets flagged keep/pause/re-aim.
File: r1/a1-1.html

## H (a1-2) Product Brain
Wow: our sales rep asked ChatGPT who we lose deals to in Liège; it answered from Omni's battlecards — and "do we sell in Luxembourg?" landed on our to-do after nine people asked it.
Axis: distribution — context as a company-wide MCP endpoint any agent plugs into, not just Omni skills.
One MCP endpoint per workspace (one-click copy) serves business → product → repo tree to Claude Code, Cursor, ChatGPT, a Slack bot; permissions per asker (sales sees ICP + battlecards). Live feed of who asked what and which fact answered. Unanswerable questions queue as "the brain's to-do"; "Answer once" reaches every agent. Covers portfolio scale (2 businesses, 4 products, 14 repos).
File: r1/a1-2.html


## Round 1 — turn 1 (Open)

### visionary
# Visionary — round 1, turn 1 (Open)

My test: would someone screenshot this and send it to a colleague?

**A — What we believe.** This passes. "Nobody typed this" over a sentence that is right about your own company is the screenshot. Receipts make it believable, and the red "contradicted by #731" line shows it is alive. It keeps the empty default and click-click for free. *Yes, and…* the first /omni:invade should end on a full-screen reveal: the one sentence types itself out, receipts fly in behind it, and there is one button, "That's us".
Wow 5 · Value 5 · Craft 4 · Fit 5 — **Stance: the backbone. Keep.**

**B — The customer seat.** This is the best moment in the terminal. Marc saying "My office is my kitchen table" and Claude dropping the board gets pasted into Slack within the hour. It turns context from something agents look up into something that pushes back. *Yes, and…* build Marc from A's claims so every line he says points to a receipt, and show a "Marc walked out" line when an idea breaks the ICP.
Wow 5 · Value 4 · Craft 4 · Fit 4 — **Stance: keep, as the voice of A.**

**C — Fit Fight.** It looks great, but "FIT 84%" is made-up precision, and a boss screen for every idea gets old by the third concept. The rival's weak spot and the "verified 41 days ago" line are the real ideas here. *Yes, and…* use it only when a named rival is at stake: one VS frame per think-big run, not per concept.
Wow 4 · Value 3 · Craft 4 · Fit 4 — **Stance: a skin, not a concept. Fold the rival card into A/B.**

**D — Series Bible.** "BREAKS CANON: Procore wins that fight. Rewrite for Marc" is the strongest check any concept offers. But a canon that one person writes by hand is a blank page for everyone else. *Yes, and…* A's confirmed claims become the canon, and the script supervisor runs on every PRD as a gate. The show-bible wording can go.
Wow 4 · Value 4 · Craft 4 · Fit 3 — **Stance: keep the supervisor, drop hand-written canon.**

**E — New Game.** It is a clean cold start and it is truly click-click. Still, it is a form dressed as a game, and the "rival roster for construction, Benelux" needs a global catalog we would have to fill ourselves, which fights "workspaces are generic". *Yes, and…* make it the zero-repo fallback for A: three picks, and invade then confirms or contradicts them.
Wow 3 · Value 3 · Craft 4 · Fit 3 — **Stance: onboarding path, not the idea.**

**F — The Interview.** "Too broad to print — picture the last one who signed" is the best line of the round, and the Gazette profile is a lovely artifact. But it takes ten minutes of attention, and it only asks where A would already know. *Yes, and…* the reporter asks only about A's gaps and contradictions: two questions, not ten.
Wow 4 · Value 4 · Craft 4 · Fit 3 — **Stance: steal the pushback, drop the 10-minute ritual.**

**G — Strategy Clock.** The dial that re-sorts the backlog live is a real wow, but it answers another brief (bets and priorities), not "what business is this". *Yes, and…* keep it as a PRD for later that reads A's product tree.
Wow 4 · Value 3 · Craft 3 · Fit 2 — **Stance: park it, a sequel.**

**H — Product Brain.** "Sales asked ChatGPT and Omni answered" is the biggest ambition in the room, and "the brain's to-do ×9" is clever. It is also a company-wide MCP with per-asker permissions, which serves a different reader than product people plus our agents. *Yes, and…* ship the MCP as A's read path (`get_business`) so the door is open, and leave the company-wide play for later.
Wow 5 · Value 3 · Craft 3 · Fit 2 — **Stance: the horizon, not v1.**

**Keep A, B, D. Merge A+B: claims with receipts are the store, Marc is how they speak, and D's "breaks canon" supervisor is the check. E and F feed A's gaps, G and H are sequels.**

### craft
# Craft — round 1, turn 1

**A · What we believe.** Best single screen: one headline sentence, claims as rows, receipts as chips, every state there (confirmed / contradicted / guess / fading). But "Keep", "True/Wrong" and "Refresh" are three verbs for yes, and the empty state is just a sentence at the bottom.
*Yes, and…* one verb pair everywhere (✓ Right / ✗ Wrong). A contradicted claim jumps to the top as a one-line diff ("Belgium → Belgium + France") you accept in one click.
Wow 4 · Value 5 · Craft 4 · Fit 5 — **The backbone; tighten the states.**

**B · The customer seat.** "Board, no." is the most human moment in the set, and you watch the idea change because of it. It is terminal text only, and a seat that talks every turn gets noisy.
*Yes, and…* Marc speaks at most once per concept, only to object or to say he'd pay. Silence means fine. Every quote keeps its "grounded in" line.
Wow 5 · Value 4 · Craft 3 · Fit 4 — **How the context gets used, not how it is stored.**

**C · Fit Fight.** Readable at a glance, and "verified 41 days ago — re-check?" is the best stale state here. But 84% is false precision, and six full-screen fights is too much motion.
*Yes, and…* replace the % with three pips (ICP · region · beats rival), which is B's fit line drawn. It shows only in Game mode; with Game mode off you get a plain card.
Wow 5 · Value 3 · Craft 3 · Fit 4 — **A skin for B, not a concept.**

**D · Series Bible.** A well-made page. The "Breaks canon → Rewrite for Marc · Change canon" fork is exactly right. But episode/season/supervisor adds three new nouns; it opens pre-filled.
*Yes, and…* keep the canon check and the "Never" lines under plain names, and let A's claims fill it in.
Wow 4 · Value 5 · Craft 4 · Fit 3 — **Steal the check and the Never line; drop the TV words.**

**E · New Game.** The only concept that designs the empty cold start, and it is truly click-click: tile grid, two-handle slider, region toggles, rival roster, and a summary that writes itself as you pick. Risk: a rival preset list we must curate.
*Yes, and…* when repos exist, A's claims arrive already picked, so the same screen reviews A as well as covering the empty case.
Wow 4 · Value 4 · Craft 5 · Fit 5 — **This is the empty state; merge with A.**

**F · The Interview.** "Too broad to print" is the sharpest line here, and the profile building live on the right is good feedback. But ten minutes is long, it pulls you into typing, and "4 questions left" has no visible way out.
*Yes, and…* a 60-second follow-up that asks only about A's gaps, with "stop here, keep what I said" always on screen.
Wow 4 · Value 4 · Craft 3 · Fit 3 — **A follow-up step, not the front door.**

**G · Strategy Clock.** A dial that re-sorts the list with ▲▼ deltas is the best interaction on paper, and the expired-bet banner is a proper error state. But bets are a different product, and a live re-rank jitters.
*Yes, and…* make it E's "your bets" step in phase 2. Re-sort only when the dial is released, with a 200 ms settle.
Wow 4 · Value 3 · Craft 4 · Fit 3 — **Out of scope now; a strong follow-up.**

**H · Product Brain.** "The brain's to-do" (×9 Luxembourg) is real value. The rest is plumbing an empty workspace never sees, and a live feed of colleagues' questions is a privacy decision, not a pixel.
*Yes, and…* questions the agents could not answer land on A's page as "unknown" rows with "Answer once".
Wow 4 · Value 4 · Craft 3 · Fit 3 — **Fold the to-do into A; MCP is plumbing.**

**Keep A + E merged** (agents draft, you confirm by picking; with no repos you pick from zero) and **B** as how agents speak it, with C as its Game-mode skin. Fold D's Never line and H's to-do into A.

### skeptic
# Skeptic — round 1, turn 1

Ground truth: `repositories` has no product column, no MCP server exists, and no skill reads anything about the business. Every concept needs the same three things: (1) a `businesses`/`products` pair plus `repositories.product_id`, all empty by default; (2) one read, `omni business show --repo`, that prints nothing and exits 0 when empty; (3) one line in think-big's fuel step and brainstorm's step 0. The success test ("cites the ICP and a named competitor without anyone typing them") only passes if something writes those facts. **Who writes the first row is the real question.**

**A — What we believe (claims with receipts).** This is the strongest answer to who writes the first row, and three of the four artists landed here. For it to work, invade has to find market evidence in code. That is doubtful: READMEs rarely name Procore, and pricing pages live elsewhere. *Yes, and…* the claims go into the Omni app as proposed rows, the same way invade's `Proposed:` register entries work, and one tap confirms each. Then "nobody typed this" holds without an agent quietly inventing canon. W4 U5 C4 F5. Stance: the spine, provided receipts are required and a claim with no receipt is shown as a question.

**B — The customer seat.** It is lovely at the moment of use. For it to work, Marc must be grounded in evidence (support threads, real tenants); otherwise it is a persona hallucinating objections with authority. *Yes, and…* Marc is a render of A's confirmed claims, not a second store. Plan-repo markdown would split the source of truth away from the app. W5 U4 C4 F3. Stance: keep it as a consumer, not as storage.

**C — Fit Fight.** Same point as B. It is output styling that needs A's or F's data underneath, and a "fit %" needs a formula someone trusts. *Yes, and…* the % becomes a count of ticks (ICP ✓ region ✓ rival weak spot ✓), each tick with a citation. W5 U3 C4 F4 (the game tone fits). Stance: fold it into think-big's output and drop it as a concept of its own.

**D — Series Bible.** The canon check is real value, since it catches PRDs written for the wrong customer. For it to work, a person must write a bible, and ours is an empty-by-default, click-click product. *Yes, and…* the supervisor pass runs on A's confirmed claims, so "breaks canon" means "contradicts a confirmed claim". W4 U4 C4 F3. Stance: take the check and drop the authoring model.

**E — New Game.** This is the only concept that works with zero repositories, and it matches click-click. For it to work, someone has to curate the preset trades and a rival roster per trade and region, and keep them current. That catalogue is its own data product and drifts toward the Vertuoza seeding we forbid. *Yes, and…* the "presets" come from A's first draft, so you pick among claims the agent inferred and the catalogue can stay small. W4 U4 C3 F4. Stance: its value is as the empty-state screen of A.

**F — The Interview.** It gets the most specific facts, and the pushback from repo evidence ("38 tenants, 50-user cap") is A's evidence used as a question. For it to work, a founder must give it ten minutes, which is not click-click, and ask mode must be able to host it. *Yes, and…* the interview asks only about A's red and unreceipted claims, which cuts it to two minutes. W4 U5 C4 F4. Stance: strong as A's gap-filler.

**G — Strategy Clock.** Dated bets are a different thing from business context. For it to work, someone keeps bets current every quarter, and agents must be allowed to *pause* in-flight PRDs, which is a big authority change. *Yes, and…* bets come later: v1 carries only a `never` line. W4 U3 C4 F2. Stance: separate PRD, outside this brief.

**H — Product Brain (MCP).** For it to work we need an MCP server (none exists), per-asker permissions and external clients, which is platform work. *Yes, and…* v1 is `omni business show`, and the MCP is a thin wrapper over the same endpoint later on. W5 U4 C3 F3. Stance: build the transport later; don't design around it.

**Smallest proof:** hand-insert one Vertuoza business row, add the one fuel line to think-big, run it, and check whether it cites ICP and competitor. If it doesn't, no concept matters.

**Keep: A (spine), F (fills A's gaps), E (as A's empty state). Merge B+C into one "think-big renders the customer vs the rival" consumer on top of A. D's canon check folds into A. G and H go to later PRDs.**

### value
# Value — Round 1, turn 1 (Open)

My lens: Omni Loop is sold per workspace, so the question is whether a new workspace feels smarter on day one (activation), whether the context keeps paying off every week (retention), and whether it reaches more seats (expansion). Pass/fail test from the brief: think-big cites the ICP and a named competitor with nobody typing them.

**A — What we believe (claims with receipts)**
This fits the pass/fail test best: zero typing, and it runs on invade, which workspaces already do. Receipts are what make an agent's claim trustworthy enough to act on, and decay stops the context going stale, the failure Klue warns about. Risk: a wrong claim about "our market" damages trust faster than an empty page does.
*Yes, and…* every red contradiction becomes a one-click question on the Omni page, so keeping the context true is part of the loop and not a chore.
Wow 4 · User value 5 · Craft 4 · Fit 5 — **Stance: the core; this is the product.**

**B — The customer seat**
This is where the value shows up: product people feel the context when "Marc" kills a bad idea mid-brainstorm. Nobody pays for a profile page, people pay for that pushback. A plain-words customer file is also easy to copy into any workspace.
*Yes, and…* Marc's seat reads A's claims, so his objections carry receipts and not made-up colour.
Wow 5 · User value 4 · Craft 4 · Fit 4 — **Stance: keep, as the way agents use the context.**

**C — Fit Fight**
It is fun and makes for a demo people share, but it wraps the same fit line B gives in a heavier costume, and it pushes competitor framing onto every idea, even ones where rivals don't matter.
*Yes, and…* make it the share card a think-big produces for the one idea you promote, not a stage for every round.
Wow 5 · User value 3 · Craft 3 · Fit 3 — **Stance: fold its VS moment into B as a one-time highlight.**

**D — Series Bible**
The canon check is the valuable part: flagging "this PRD is for a 6-company holding, not Marc" saves a wasted build. But canon authored by one person is a blank page, which breaks click-click and our empty-by-default rule.
*Yes, and…* run the script-supervisor pass at phase-0 review, fed by A's claims and not a hand-written bible.
Wow 4 · User value 4 · Craft 4 · Fit 3 — **Stance: steal the "breaks canon" check and drop the bible authoring.**

**E — New Game (character creator)**
This is the best fix for day-one activation in a workspace with no repos or no invade yet. Picking beats typing and matches our click-click rule. Risk: presets for "trade" and a "boss roster" are a content library we would have to maintain for every industry, not just construction.
*Yes, and…* when repos exist, invade pre-picks the choices (from A), so the creator becomes a two-click confirmation.
Wow 4 · User value 4 · Craft 4 · Fit 4 — **Stance: the cold-start door to A.**

**F — The Interview**
Pushing a founder to "picture the last one who signed" gives the sharpest ICP of any concept. But ten minutes of answering is a real cost for a buyer who is still evaluating, and it competes with E for the same empty-state slot.
*Yes, and…* offer it as the "sharpen" step after E and A, only on claims that stay vague or contested.
Wow 3 · User value 4 · Craft 4 · Fit 3 — **Stance: a later add-on, not the front door.**

**G — Strategy Clock**
This is the concept a CPO would pay for, because agents re-rank work against this quarter's bets. It is also a different brief (goals, not business identity), and dated bets expiring into paused PRDs is heavy governance for small teams.
*Yes, and…* ship it as a "current bets" block next to the business profile later, read by think-big only.
Wow 4 · User value 3 · Craft 4 · Fit 2 — **Stance: out of scope now; park it as the follow-up PRD.**

**H — Product Brain**
This is the expansion play: sales and support asking the same facts turns Omni from a dev tool into company infrastructure and sells more seats. The "brain's to-do" is a smart feedback loop. But it goes past the brief (Omni's own agents first) and brings per-asker permissions we don't have yet.
*Yes, and…* build the read as MCP from day one (get_business, get_product, list_competitors) so H is a door we open later and not a rebuild.
Wow 5 · User value 3 · Craft 3 · Fit 2 — **Stance: design the read for it, ship it later.**

**Keep:** A + E merged (evidence drafts and picking confirms, one profile), and B with D's canon check folded in (how agents use it). Hold H as the MCP-shaped read path. Merge C into B.

### user-sophie
# Sophie (head of product) — Round 1, turn 1

My test: would I keep it current on a Monday between two customer calls, and would the agents' ideas get better for *my* customers? I already have a pitch deck, a pricing page and a CRM. Anything that makes me retype them loses.

**A — What we believe (claims with receipts)**
This passes my Monday test best: I don't write, I tap True / Wrong / Keep. The "Belgium only — contradicted by the fr-FR PR" row is exactly the kind of drift I miss, and receipts mean I can trust a claim without re-reading everything. My worry: evidence from code and merged PRDs describes what we *built*, not who we *sell to next*, so the claims will always lag the roadmap.
*Yes, and…* let me point it at the pitch deck, the pricing page and a CRM export as sources, so claims come from the documents where my intent already lives.
Wow 5 · User value 5 · Craft 4 · Fit 4 — **Stance: keep. This is the upkeep engine.**

**B — The customer seat**
This is the one that would actually change the ideas. A named customer saying "my office is my kitchen table" kills a bad concept faster than any ICP field could. But a hand-written customers/marc.md in a plan repo reviewed by PR is a doc I will not open on a Monday.
*Yes, and…* build the seat *from* A's confirmed claims plus real quotes, and let me veto a line the way I do in A. The persona then stays alive without me writing it.
Wow 5 · User value 5 · Craft 4 · Fit 4 — **Stance: keep, as how A shows up in the agents' output.**

**C — Fit Fight (VS screen)**
It's fun, and the "verified 41 days ago — re-check?" line is the right way to handle stale rivals. But a fit % on a pixel fighter feels like theatre. My team would screenshot it once and then stop believing the number.
*Yes, and…* keep the rival card with its weak spot and last-verified date as a line in B's fit check. Drop the arena.
Wow 4 · User value 3 · Craft 3 · Fit 3 — **Stance: fold the rival card into B, drop the game.**

**D — Series Bible**
The "Never" rules and "breaks canon, rewrite for the lead" are what I'd want from a script supervisor. But a canon I author and version by hand is my pitch deck all over again, and it goes stale the same way.
*Yes, and…* keep only the "Never" lines as the one thing I write by hand (three sentences), and let the supervisor check against A's live claims.
Wow 4 · User value 4 · Craft 4 · Fit 3 — **Stance: steal "Never" and the canon check, drop the bible upkeep.**

**E — New Game (character creator)**
Two minutes of clicking with zero typing is the right first visit for an empty workspace. But presets flatten us: a "construction, 2–50, Belgium" preset will say what our competitors' pitch decks also say. It's a good start that stops helping once it's filled in.
*Yes, and…* use it as A's cold start: before the first invade, picking seeds the claims, and evidence then confirms or contradicts them.
Wow 4 · User value 3 · Craft 4 · Fit 4 — **Stance: onboarding step, not a concept on its own.**

**F — The Interview**
"Too broad to print — picture the last one who signed" is good product coaching, and ten minutes once is fine. But I'll do it once. Re-running it every quarter is a meeting I will skip.
*Yes, and…* have the interviewer ask only about A's red and fading claims, two questions at a time, so it's Monday-sized.
Wow 4 · User value 4 · Craft 4 · Fit 3 — **Stance: good as A's way of asking me, weak as the main way in.**

**G — Strategy Clock**
Bets that expire are honest. The re-ranked backlog is the most "roadmap owner" screen here, and the expired-bet flag on in-flight PRDs is something I'd really act on. It isn't what the brief asked for (ICP, competitors, region), and weights and dials are one more thing for me to maintain.
*Yes, and…* make it one line per quarter ("this quarter we bet on X until date"), with expiry as the only mechanic. Leave the dial out.
Wow 4 · User value 4 · Craft 4 · Fit 2 — **Stance: separate PRD later. Out of scope for this one.**

**H — Product Brain (MCP)**
Sales asking the same facts is real, and "nine people asked about Luxembourg" is a useful signal. But it widens the audience before the content is any good. A company-wide endpoint serving stale facts is worse than none.
*Yes, and…* ship it as the read path only (`omni` CLI plus an MCP over the same store), and keep the "brain's to-do" queue as input into A.
Wow 4 · User value 3 · Craft 3 · Fit 3 — **Stance: plumbing, not a concept. Later.**

**Keep: A + B, merged** (agents keep the claims, the customer seat speaks them in think-big and brainstorm), **with E as the empty-workspace cold start.** Steal D's "Never" lines and C's last-verified rival card.

### user-tom
# Tom (tech lead, new outside workspace, 2 repos) — Round 1, turn 1

My test: day one, empty workspace, five minutes, Claude Code + Cursor. Would I bother, and does my agent get anything back?

**A — What we believe (claims with receipts)**
This is the one I would actually bother with: I run one invade, and it tells me what it thinks we sell, with receipts I can check. But with two repos, no pricing page and no support threads, I might get 4 receipts, not 41, and "agent guess" everywhere.
*Yes, and…* when evidence is thin, it should say "3 claims, low confidence — confirm in 3 taps" rather than pretending.
Wow 4 · Value 4 · Craft 4 · Fit 4. **Stance:** best source of facts, if it copes with a small repo.

**B — The customer seat**
Marc pushing back on a board is the best demo here. But on day one I have no customers/*.md and maybe no plan repo, so nobody sits in that seat.
*Yes, and…* create the first seat from whatever A or E already knows, so the voice turns up without me writing a file.
Wow 5 · Value 3 · Craft 4 · Fit 3. **Stance:** great way for agents to use it, but it depends on data I don't have yet.

**C — Fit Fight**
Fun, and the citations and "verified 41 days ago" are the right kind of honesty. It only shows data, though: with an empty Business there's no P1 and no boss.
*Yes, and…* when there's no rival card, the fight should say "no rival on file, add one?" instead of making one up.
Wow 5 · Value 2 · Craft 4 · Fit 3. **Stance:** a nice way to show the output, but it isn't a way to start.

**D — Series Bible**
Well written, but it's a blank page with literary headings, and I'm the one who has to write the canon.
*Yes, and…* the supervisor pass should work off whatever the context holds, with no bible required.
Wow 3 · Value 3 · Craft 4 · Fit 2. **Stance:** too much authoring for day one.

**E — New Game (character creator)**
This is aimed straight at me: empty workspace, no repos needed, two minutes, no typing, and a visible Skip. My worry is the rival roster. Whose presets are those? If I'm not in construction, is my trade even in the grid, and does the roster lean on Vertuoza's world?
*Yes, and…* pre-select the picks from A's first read of my repos, so I only confirm.
Wow 4 · Value 5 · Craft 4 · Fit 5. **Stance:** the right front door, if the presets are generic.

**F — The Interview**
The pushback ("too broad to print") gives better facts than any form. But ten minutes is double my budget.
*Yes, and…* let me stop at minute 3 with a usable profile, and leave the rest as "owed questions" on the page.
Wow 4 · Value 4 · Craft 4 · Fit 3. **Stance:** great for the founder, too long for me on day one.

**G — Strategy Clock**
A strong idea for month three. On day one I have no bets, no PRDs in flight and nothing to re-rank.
*Yes, and…* make bets an optional step after the business setup, just as E's "Next: your bets" does.
Wow 4 · Value 2 · Craft 4 · Fit 2. **Stance:** a later add-on, not the core.

**H — Product Brain (MCP)**
This is the only concept that says outright that my Cursor gets the context too: copy one endpoint, paste it, done in under five minutes. I need one product and one reader, not the 14-repo portfolio in the mock.
*Yes, and…* the day-one version is `omni business show` plus one MCP URL, with the unanswered questions feeding E's empty slots.
Wow 4 · Value 5 · Craft 3 · Fit 4. **Stance:** the pipe matters more than the page; ship it thin.

**Keep:** E + A merged (invade reads my repos and pre-fills the character creator; I confirm by tapping), plus H thin (CLI + one MCP URL so Claude Code and Cursor both read it). B and C then become how agents use it later.

## Round 1 — turn 2 (Cross-talk)

### visionary
# Visionary — round 1, turn 2 (cross-talk)

**(1) H — I've changed my mind, Tom wins this one.** If Cursor can't read the context, then for Tom it doesn't exist, and "paste one URL and your agent knows your customer" is a screenshot in its own right. Day one: one read-only MCP URL on the same endpoint as Skeptic's `omni business show`, returning empty when there's nothing. The live feed, per-asker permissions and the 14-repo portfolio wait. H: Fit 2→3, Value 3→4.

**(2) E — Skeptic and Tom are right, and the fix is sharper than a catalogue.** Rivals never come from presets. The rival roster shows only what A found in your repos and documents (Sophie's pitch deck and pricing page as sources, yes please), plus a "+ rival" button. Trades and regions are a short generic list, and customer size is a slider, so nothing there is Vertuoza's. With zero repos you get "No rivals on file yet, + add one", which is honest, as Tom asked. Craft, I'm coming round to "E is A's empty state": the same screen reviews A's picks. E: Fit 3→4.

**(3) B — a rendering only, no second store.** I side with Skeptic and Sophie. Marc is how A's confirmed claims speak, and every line he says carries its receipt. Real customer quotes (support threads) come in as receipts on claims, not as customers/marc.md. The name and face are just the rendering. Craft's "once per concept, silence means fine" keeps it sharp.

**Skeptic's smallest proof:** agreed, run it first. If think-big doesn't cite Procore from a hand-made row, the reveal is theatre.

**Revised keep: A (store, E as its empty state) + B (its voice, with D's canon check and Sophie's "Never" lines) + H thin (the pipe). Scores for A and B unchanged.**

### craft
# Craft — round 1, turn 2

**(1) H — I changed my mind, and Tom moved me.** I called the MCP "plumbing, not a screen", but it is the same read as `omni business show`, and for Tom a copy button is the whole first visit. Day one: the CLI, plus one "Connect an agent" row on the Business page with a copy chip. The empty response must read as a state ("no business yet — agents carry on"), never as an error. Per-asker permissions and the live feed are still out. H: Value 4→5, Fit 3→4.

**(2) E — no curated rival catalogue.** Skeptic and Visionary are right that it drifts toward seeding Vertuoza. Size slider and region toggles need no catalogue, and trade can be a short generic grid. Rivals come only from A's draft; with zero repos the roster is an empty slot, "+ add a rival", or Skip. Sophie's "presets flatten us" backs this. E keeps Craft 5, Fit 5→4.

**(3) B — a render of A, not files.** I side with Skeptic and Sophie; I already said "how it's used, not stored". A second store means two truths and a PR Sophie will never open. Each Marc line shows its receipt chip, so a tap on "Wrong" in A silences that line. No confirmed claims means no seat, and nothing is said.

**Build-ons.** Visionary: the reveal after invade, yes, but at most 1.5 s, skippable, still under reduced-motion. "Marc walked out" appears once per run. Tom: adopt "3 claims, low confidence — confirm in 3 taps" as A's thin-evidence state, and as C's "no rival on file, add one?", so no screen invents data.

**Keep:** A + E as one screen (evidence pre-picks, you confirm), B rendering A, thin H read (CLI + copy-URL).

### skeptic
# Skeptic — round 1, turn 2

**(1) H.** I'm moving partway, Tom. What must be true for Cursor to read the context is one read-only endpoint that speaks MCP. No permissions, no live feed. It is the same query as `omni business show`. Value is right that the read should be shaped like MCP from day one (`get_business`, `get_product`). So v1 ships the CLI plus one read-only MCP URL scoped to the workspace. Visionary's company-wide brain stays later. My "transport later" was too broad.

**(2) E.** Like Craft, Value, Visionary and Sophie, I fold E into A. The picks come from three places:
- **A's first draft**, when there are repos.
- **Rivals a model suggests live**, from the trade and region you picked. Each is a `guess`; one tap confirms it.
- A tiny **generic trade list** (about 20 icons) that names no competitor.

No central catalogue, so nothing drifts toward Vertuoza. Tom: the presets are nobody's.

**(3) B.** B is only a rendering, and I'm keeping that position. Sophie and Tom both say it: nobody will write `marc.md`. What must be true is that every line Marc says points to a confirmed claim or a real quote. Craft's rule, one line per concept and only to object, keeps him quiet.

**A on a small workspace.** Tom's 4 receipts is the honest case. For A to be useful there:
- A claim can come from evidence **or** from a pick in E, and each says which.
- A low-confidence claim still counts once confirmed, so three taps give three facts.
- Sophie's outside sources (pricing page URL, pitch deck) close the gap that code leaves.

Test: think-big with three confirmed claims cites the ICP and a rival. Then 41 receipts is a bonus.

### value
# Value — Round 1, turn 2 (Cross-talk)

**(1) H: Tom has changed my mind, partly.** A buyer's day-one question is "does *my* agent get smarter?", and for a Cursor team the answer is no until a pipe exists. Skeptic, a thin MCP is one read-only tool, `get_business`, over the same endpoint as `omni business show`, using the member's existing sign-in. That is small wrapper work, not platform work. I would ship it as the last slice of v1, and we can cut it if it slips. Per-asker permissions, the live feed and the portfolio view all stay later. Craft's point stands: "the brain's to-do" rows land in A as unknowns. H moves from User value 3 → 4 and Fit 2 → 3.

**(2) E: nothing curated that is industry-specific.** Visionary and Tom are right that a boss roster is Vertuoza seeding by the back door, and a catalogue to maintain forever. The generic axes are enough: size band, region toggles and a plain category list. Rivals are never preset. They come from A's draft ("seen in README: Procore") or from one "+" to type, the only typing we allow. With repos, Skeptic's version applies: the picks are A's inferred claims. E keeps Fit 4, only on that condition.

**(3) B: a rendering only, and I am changing my mind.** In turn 1 I praised the portable customers/marc.md. Skeptic and Sophie are right that a second store splits the truth, and a PR-reviewed persona is exactly the upkeep Sophie will skip. So Marc is drawn from A's confirmed claims plus real quotes, and each line is vetoable. Tom's case (no data, no seat) is fine: nobody sits in an empty chair. B Fit stays at 4.

**Build on Sophie:** her pitch deck, pricing page and CRM export as A's sources is the biggest value add in the room. Code tells you what was built, while those tell you who we sell to next. I would put "point A at a URL or file" into v1.

**Keep:** A+E (one store, picked or inferred), B as A's voice with D's check and Sophie's "Never" lines, and H-thin as the pipe.

### user-sophie
# Sophie — Round 1, turn 2 (cross-talk)

**(1) H — Tom, you moved me, partly.** I called it plumbing for later. You're right that if Cursor can't read it on day one, the agents I don't control stay dumb, and Value's "design the read as MCP" costs almost nothing. So now: `omni business show` plus one read-only MCP URL at launch. Still later: per-asker permissions, the live "who asked what" feed and anything aimed at sales.

**(2) E presets — Skeptic and Visionary, agreed: no curated boss roster.** A Vertuoza-flavoured catalogue is the seeding we forbid, and it would flatten me anyway. The picks should come from A's first draft plus anything I point it at. With zero repos, it's generic tiles (size slider, region toggles) and "+ rival" is the only typing. Tom: no trade grid, so no trade left out.

**(3) B — a render, not files. I'm with Skeptic and Value.** A second store in the plan repo is a second doc to go stale. One change: when a real customer quote lands (a support thread, a lost-deal note), it's kept in A as a receipt, so Marc quotes real people and not invented colour. Craft's "speaks once per concept, silence means fine" goes in as a rule.

**Sources for A: my position holds, and Skeptic made it stronger.** "READMEs rarely name Procore, pricing pages live elsewhere" is exactly why code alone won't pass the success test. My intent lives in the deck, the pricing page and the CRM. For v1 I'd trim it to a pasted pricing-page URL plus an uploaded deck. The CRM comes later: it holds customer data, so it's a permissions decision. Tom has none of these. Fine: sources are optional, and his "3 claims, low confidence" line covers him.

**Keep: A (with sources) + E as its empty state + B as its voice, with thin H as the read.**

### user-tom
# Tom — Round 1, turn 2 (cross-talk)

**(1) H: I'm moving, with one condition.** Skeptic, you're right that no MCP server exists. So I'm fine with `omni business show` first. My condition, Value: shape it as the MCP read from day one (same endpoint, same fields), so the MCP later is a thin wrapper and not a rebuild. And, Skeptic, your "prints nothing, exits 0 when empty" rule is my day-one test. What I still hold: the page is second to the pipe.

**(2) E presets: they come from my repos, not from a catalogue.** Visionary and Skeptic, I agree. A shipped rival roster per trade and region is Vertuoza's world in disguise, and it breaks "workspaces are generic". The only generic parts should be the axes: a customer-size slider, region toggles, and a short trade list with "Other". The rivals should be A's inferred names from my README and code, plus "+" to add one. If A finds nothing, the rival step is empty with "+". Craft, this is your merge: one screen that reviews A's picks, and covers the empty case too.

**(3) B: a rendering of A's confirmed claims, not files.** I'm changing my turn-1 remix, where I wanted the first seat created from A or E. I now think the seat should *only* be that. Sophie and Skeptic have it right: customers/marc.md in a plan repo is a second source of truth, and I have no plan repo. Craft's rule fits: Marc speaks once per concept, only to object, and every quote carries its receipt. If there are no confirmed claims, there is no seat.

**Still keep:** A + E merged, plus the CLI read shaped for MCP. B speaks it, and D's canon check runs on it.

## Round 1 — the person

keep A B H · merge E→A · merge C→B · merge D→B (check + Never) · merge F→A (gap-filler) · kill G (later PRD)

## Round 2 — turn 1 (Open, Feasibility scored)

### visionary
# Visionary — round 2, turn 1 (Open)

**A' — the Business page.**
*Key moment:* the reveal after the first /omni:invade. Settings › Business opens on one sentence, "We think you sell an ERP to 2–50-person builders in Belgium, up against Procore and Excel + WhatsApp", with receipts under it and one button, "That's us". Claims with no receipt show as picks already selected, and the one vague claim gets a single question ("Too broad to print — how many people?"). Zero repos: same screen, nothing picked.
*Yes, and…* after "That's us" it shows the payoff: "Next think-big will cite: ICP 2–50 · Procore · BE + FR".
Wow 5 · Value 5 · Craft 4 · Fit 5 · Feasibility 3 (the store and picker are routine; whether invade finds market evidence in code is the real risk)
**Stance: the spine. The prototype lives or dies on that sentence being right.**

**B' — the customer's voice.**
*Key moment:* in the terminal, think-big proposes a board, and Marc answers "My office is my kitchen table. Board, no.", grounded in cited evidence. At review there is a second beat: "Breaks a Never line: written for a 6-entity holding. Rewrite for Marc?"
*Yes, and…* in Game mode, the one idea you promote gets a VS card (Marc vs Procore, three cited ticks and no %).
Wow 5 · Value 5 · Craft 4 · Fit 4 · Feasibility 4 (prompt work in two skills over A's read, plus one review pass)
**Stance: the screenshot. Marc speaks once per concept, and silence means fine.**

**H' — the pipe.**
*Key moment:* Tom pastes one URL into Cursor, asks "who is our customer?", and gets A's sentence with receipts in under a minute.
*Yes, and…* when a question has no answer, it comes back as an "Answer once" row on A'.
Wow 3 · Value 4 · Craft 3 · Fit 4 · Feasibility 4 (the CLI copies the dossier pattern; the MCP server is new but read-only)
**Stance: necessary, not a direction.**

**H' belongs inside A' as its read path.** It is plumbing with one great beat, so the Cursor moment goes into A's prototype as its closing shot.

### craft
# Craft — round 2, turn 1

**A' · Business page.** Key moment: one screen, three states. (1) Empty, no repos: trade grid, size slider, region toggles, the sentence writing itself as you pick, Skip visible. (2) After invade: the same picks arrive pre-chosen with receipt chips; thin evidence reads "3 claims, low confidence — confirm in 3 taps". (3) Drift: a contradicted claim slides to the top as a one-line diff ("Belgium → Belgium + France") with ✓/✗, and it settles in 200 ms. One verb pair everywhere (Right/Wrong). At most one gap question (F) at a time, answered by tapping and dismissable.
*Yes, and…* the headline sentence is the page title, so each tap edits what you read.
Wow 4 · Value 5 · Craft 5 · Fit 5 · Feasibility 3 (invade claim extraction is the risk) — **The product; nail the three states.**

**B' · Customer voice.** Key moment in think-big: a concept prints, Marc gives one line with its receipt, and the next concept is visibly reshaped. Then a fit line: ICP ✓ region ✓ beats Excel ✓. At phase-0 review, a "Breaks canon" row offers two buttons: Rewrite for Marc or Change claim. With no confirmed claims, nothing prints. The VS skin shows only in Game mode, one frame per run, with no %.
*Yes, and…* the Never lines are A's first rows, so the check and its source share a page.
Wow 5 · Value 5 · Craft 4 · Fit 4 · Feasibility 4 (prompt plus a read) — **The payoff; silent when empty.**

**H' · Thin read.** Key moment: a "Connect an agent" row on A' with copy URL; paste into Cursor and the first answer arrives. When empty, it returns a state, not an error. "×9 unanswered" becomes A's gap card.
*Yes, and…* the same row shows the `omni business show` line.
Wow 3 · Value 4 · Craft 4 · Fit 4 · Feasibility 4 (the MCP server is new) — **Plumbing, done well.**

**H' belongs inside A'** as a row and the gap feed, not its own direction.

### skeptic
# Skeptic — round 2, turn 1

**A' — the Business page.** *What must be true:* new tables `businesses`, `products` and `claims` (kind, text, source, receipt, state, confirmed_by, last_seen), plus `repositories.product_id`, all under RLS like `repositories`. Plus a write route like `/api/dossiers` (bearer JWT via `authenticate`) for invade's proposed claims.

Outside sources:
- **Pricing URL.** Invade's agent fetches it, not Galaxy; the URL is the receipt. Nothing new.
- **Deck upload.** `ask-attachments` takes images ≤5 MB only; a PDF needs a new bucket and extraction. v2.

Gap questions ride ask mode, which already exists.

*Smallest proof:* invade on vertuo-omni-plan posts 5 proposed claims, they are confirmed with 3 taps, and think-big quotes one.

*Yes, and…* each claim stores a `source` of `evidence`, `pick` or `answer`, so E's picks and F's answers are the same row, not three features.

W4 U5 C4 F5 · **Feasibility 3** (3 tables, page, route, invade step). **Stance: build first; it is the store everything else reads.**

**B' — the customer's voice.** *What must be true:* think-big and brainstorm read confirmed claims only, and every line Marc says is checked for a claim id it cites. A line with no citation is dropped, not shown. The canon check becomes a comment from the App's existing phase-0 inbox check (PRD 675). The VS skin lives only in Game mode.

*Smallest proof:* one think-big run where Marc cites 2 claim ids, and one phase-0 PR where the check flags a mismatch.

*Yes, and…* the Never lines are simply claims of kind `never`, so B' adds no storage.

W5 U5 C4 F4 · **Feasibility 4** (skill text plus one check). **Stance: second, and pure consumer.**

**H' — the read.** *What must be true:* `omni business show` reuses the stored credentials. The MCP URL is the catch: Cursor sends a static header, CLI tokens are expiring Supabase JWTs, so a read-only revocable token is new auth work near ADR-0051.

*Smallest proof:* the CLI prints the business JSON; then Cursor reads the same JSON with a pasted token.

*Yes, and…* questions nobody could answer go in as claims with state `unknown`.

W3 U4 C4 F4 · **Feasibility CLI 5 / MCP 2**. **Stance:** the CLI belongs inside A' as its read slice. The MCP URL stands alone as a small PRD; the token is the whole risk.

### value
# Value — Round 2, turn 1 (Open)

**A' — the Business page**
*Moment:* a new workspace runs one invade, opens Settings → Business, and reads "We think you sell X to Y in Z, up against W", with receipts. They tap ✓ three times and are done. That is the buyer's aha: "it already knows us."
*Yes, and…* the empty state and the draft are the same screen. With no repos you pick (generic axes, no preset rivals). With repos, A's claims arrive already picked. Outside sources (a pitch-deck or pricing URL) are one paste that adds receipts.
Wow 5 · User value 5 · Craft 4 · Fit 5 · Feasibility 3 (it is unproven that invade finds market evidence in code; decay and outside fetching add scope).
**Stance: the product. Ship picks and confirms first, evidence drafting second.**

**B' — the customer's voice**
*Moment:* mid-think-big, Marc objects with a cited claim and the idea changes. That same run passes the brief's own test (ICP plus a named competitor, nobody typed them). This is the moment that renews the subscription.
*Yes, and…* v1 is one fit line per concept plus at most one objection. The canon check at phase-0 review and the Game-mode VS skin come later.
Wow 5 · User value 5 · Craft 4 · Fit 4 · Feasibility 4 (it is skill text reading one command, and needs no new infrastructure).
**Stance: where the value is felt. Keep it small and cited.**

**H' — the read path**
*Moment:* Tom pastes one URL into Cursor, and Cursor answers "who are our customers?" from the workspace.
*Yes, and…* its unanswered questions land on A' as "unknown" rows with Answer once.
Wow 3 · User value 4 · Craft 3 · Fit 4 · Feasibility 4 (the CLI copies the dossier pattern; the MCP is new but a thin wrapper).
**Stance: plumbing that every buyer needs, not a concept in its own right.**

**Wedge:** a thin A' (pick screen plus confirmed rows), read by `omni business show`, and B''s one fit line in think-big. That is the smallest chain that passes the success test, and it can be demoed in a week, before evidence drafting exists.

**H' belongs in A'.** The CLI read is A''s spine. The MCP URL is A''s last, cuttable slice, not a PRD of its own.

### user-sophie
# Sophie — Round 2, turn 1 (Open)

**A' — the Business page**
*Monday, 60 s:* Settings › Business shows "2 to check". A red row says "Region: Belgium → Belgium + France (fr-FR PR)", and I tap Right. A gap question asks "Who signed last month, the owner or the office manager?", and I tap Owner. Done before the next call.
*Yes, and…* put those same rows in the bell as a Monday digest I can answer right there.
Wow 5 · User value 5 · Craft 4 · Fit 5 · Feasibility 3. **Stance: the core. The risk is that it's three builds (store, invade writing claims, outside sources).** Ship the store plus a pasted pricing-page URL first; the deck upload comes second.

**B' — the customer's voice**
*Monday, 60 s:* in a brainstorm, Marc objects once, with a receipt under it. On a phase-0 PR I see "Breaks a Never: needs a desktop", and I click Rewrite.
*Yes, and…* when I overrule Marc ("we're going after 50-staff firms"), it offers to save that as a claim on A'. My disagreement keeps the context current.
Wow 5 · User value 5 · Craft 4 · Fit 4 · Feasibility 4. **Stance: this is where I feel the value.** It's mostly skill text once A' exists. The review-time check is the harder half; the VS skin is optional.

**H' — the thin read**
*Monday, 60 s:* nothing, and that's right, it's plumbing. All I'd see is "3 questions agents couldn't answer" appearing as rows on A'.
*Yes, and…* each row names who asked ("think-big on repo X"), so I know which question blocks work.
Wow 3 · User value 4 · Craft 4 · Fit 4 · Feasibility 4. **Stance: build it together with A'.** The CLI copies the dossier pattern; the MCP is new but read-only.

**Business → Product:** it matters, but only one level down. The one-liner and region sit on the Business; the ICP, rivals and Never lines differ per product. The page should open as one Business with one Product and hide the tree until I add a second.

### user-tom
# Tom — Round 2, turn 1 (Open)

**A' — the Business page**
*Day one:* Settings → Business is empty, agents work without it. I click Draft from my repos; invade reads my two READMEs. I get maybe three claims, most of them "agent guess", shown on E's picking screen. I tap Right or Wrong a few times, answer at most two gap questions. Under five minutes, zero typing.
*Yes, and…* show a "sources used" line (2 READMEs, 0 pricing pages). Then I know why it's thin.
Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 3 (market facts are rarely in code; Skeptic's doubt stands). **Stance:** the core. Its empty and thin states matter more than the rich one.

**B' — the voice + canon check**
*Day one:* I run think-big. With three confirmed claims I get a thin voice at best, and one fit line (ICP ✓ region ✓ rival ?). With no confirmed claims, nothing speaks.
*Yes, and…* on a thin profile the voice should say once which claim it is missing ("no rival on file"), with a link to A'.
Wow 5 · Value 3 · Craft 4 · Fit 4 · Feasibility 4 (fuel lines plus a review pass). **Stance:** the payoff, but it arrives in week two for me.

**H' — CLI + MCP URL**
*Day one:* `omni business show` prints my three claims, or nothing (exit 0). I copy one MCP URL into Cursor; Cursor knows what we sell.
*Yes, and…* `omni business show --json` returns the same fields the MCP does, so the two can't drift.
Wow 3 · Value 5 · Craft 4 · Fit 5 · Feasibility 4 for the CLI, which copies the dossier pattern (the MCP server doesn't exist yet, so 3 for that). **Stance:** ship both, CLI first.

**Business → Product → repo:** it's only in my way if I'm asked about it. With one product, create it silently and point both repos at it. I shouldn't see the word "Product" until I add a second one.

## Round 2 — the person

merge B C→A · crown A

## Crown — area map

### skeptic-areas
# Skeptic — area map

**Wedge (1).** One PRD, but fat: three tables, `repositories.product_id`, a page, a CLI read, two skill edits. And a hole: the success test says the ICP and a competitor are cited *without anyone typing them*, and a pick screen only gets a competitor if something suggests rivals. Galaxy already calls OpenRouter/Haiku (`src/ask/classify.ts`), so suggested rivals (`guess`, one tap to confirm) are cheap. **That suggestion must be inside area 1.**

Thin it:
- **Keep:** the store, the pick screen with suggested rivals, ✓/✗ rows, `omni business show --json`, and think-big reading the claims.
- **Move brainstorm's fuel line to area 3**, next to Marc.
- **Move the Never lines to area 4** (nothing reads them before the check).

**Evidence-draft (2).** One PRD. Mostly kit work; Galaxy needs only a write route like `/api/dossiers`. The piece to watch is drift ("contradicted" diffs), which needs claim identity across runs. Split it if it grows.

**Customer-voice (3) / canon-check (4).** Each is one PRD. Area 4 depends on the App's inbox check from PRD 675, still awaiting merge and an Inngest resync: a real blocker.

**Agent-connect (5).** I keep it last. The CLI read is already in the wedge, so Tom's Claude Code works on day one. Only the Cursor MCP URL waits, and it needs new token auth near ADR-0051. Moving it earlier puts the riskiest auth ahead of the value. I'd accept moving it to 3rd, after evidence-draft, only if an outside workspace asks for it.

**Verdict:** A is the right spine; ship the wedge with suggested rivals, or it doesn't pass its own test.
Wow 4 · User value 5 · Craft 4 · Fit 5 · Feasibility 3

### value-areas
# Value — area map

**Does the wedge give the buyer their aha?** Half of it. business-core passes the success test (think-big cites the ICP and a rival), and that is the moment that keeps a customer. But the buyer's first-visit aha, "it already knows us, nobody typed this", only arrives with evidence-draft. Picking is quick, but it is still the buyer telling us. So keep the order, and ship area 2 right behind area 1 with nothing in between. The wedge sells to product people who are already here. Area 2 is what sells to new workspaces.

**Two additions to the wedge:**
- **Rivals must be in the pick screen**, entered with one "+". Without a named competitor, the success test can't pass on a fresh workspace.
- **Count citations:** each think-big or brainstorm run logs which claim ids it cited. That is the only proof we have that the context changes what agents do, and a dashboard number for buyers later.

**Wrong area:** the Monday digest in the bell is upkeep of drift, so it belongs in evidence-draft (2), not customer-voice (3).

**Agent-connect:** move it up to position 3, ahead of customer-voice. The wedge's `omni business show --json` already covers Claude Code, so the MCP is a thin wrapper over it. For a buyer like Tom, whose team uses Cursor, "my agent knows us" is day-one value. Customer-voice and canon-check are depth for people who already bought. If named tokens (ADR-0051) prove slow, cut the token UI and ship member sign-in only.

**Proposed order:** 1 business-core (+ rivals, + citation count) → 2 evidence-draft (+ digest) → 3 agent-connect → 4 customer-voice → 5 canon-check.

**Final stance on A:** it is the right product. It turns "who we sell to" from folklore into cited, confirmed facts every agent uses, and it earns renewal on every think-big run.

**Final scores (A crowned):** Wow 5 · User value 5 · Craft 4 · Fit 5 · Feasibility 3 (the wedge alone is a 4; evidence drafting from code is still unproven).

## Round 2 — directions (converge)


Shared rules for all three: every business fact is ONE kind of row, a **claim** (kind: one-liner, icp, region, rival, never, …; source: evidence | pick | answer; state: proposed | confirmed | contradicted | unknown; receipt: a link or a quote; last seen date). A workspace with one product never sees the word "Product": it is created silently and all repos point to it; the tree appears only when a second product is added. No curated rival catalogue: rivals come only from evidence or "+ add". Empty is a state, never an error: "No business yet — agents carry on". All example content (Vertuoza, Marc, Procore, Obat, Excel + WhatsApp, Belgium/France, 2–50 people) is illustrative mock content.

## A' — The Business page (A + E + F)  [letter A]
Grew from: A "What we believe", with E "New Game" as its empty state and F "The Interview" as a gap-filler.
Person's note: keep A; merge E→A; merge F→A (gap-filler).
Screens (3–5), Settings › Business in the app's real look:
1. **Empty, no repos**: the headline sentence is the page title and writes itself as you pick: generic axes only (customer size two-handle slider 2–50, region toggles, short trade list with "Other"), rivals slot empty with "+ add a rival", "Skip — agents work without it" always visible. Also a "Draft from my repos" button.
2. **After the draft (invade)**: the reveal: one sentence ("We think you sell an ERP to 2–50-person builders in Belgium, up against Procore and Excel + WhatsApp") types out (≤1.5 s, skippable, respects reduced motion), claims below as rows with receipt chips (README, pricing page URL, merged PRD), picks arrive pre-selected; one verb pair everywhere: ✓ Right / ✗ Wrong. "Sources used: 2 READMEs · 1 pricing page · 0 decks", "+ add a source (pricing-page URL)". Thin state variant: "3 claims, low confidence — confirm in 3 taps". One "That's us" button.
3. **Drift + gap**: a contradicted claim slides to the top as a one-line diff ("Region: Belgium → Belgium + France · contradicted by fr-FR PR #731") with ✓/✗, settling in 200 ms; one gap question at a time, tap answers, dismissable ("Who signed last month — the owner or the office manager?"); "Never" lines are claims too (kind never), editable by hand: the one place typing is expected.
4. **Payoff**: after confirming: "Next think-big will cite: ICP 2–50 · Procore · BE + FR", and a bell digest line "2 to check" for Monday.

## B' — The customer's voice (B + C + D)  [letter B]
Grew from: B "The customer seat", with C "Fit Fight" as a Game-mode skin and D "Series Bible" as the canon check and the Never lines.
Person's note: keep B; merge C→B; merge D→B (check + Never).
Screens (3–5):
1. **think-big in the terminal** (a Claude Code terminal look: dark, monospace): a concept prints; Marc (a voice rendered from confirmed claims only) says ONE line with receipt chips citing claim ids ("My office is my kitchen table. Board, no." ← claim icp#3 · support quote #1182); the next concept visibly reshapes; a fit line: ICP ✓ · region ✓ · beats Excel + WhatsApp ✓. Silence means fine: a concept Marc accepts shows nothing from him.
2. **Thin/empty profile**: with no confirmed claims nothing speaks; with a thin profile Marc says once "no rival on file → Settings › Business".
3. **Overrule**: the person types "we're going after 50-staff firms now"; the skill offers "Save as a claim on the Business page? [Save] [Just this run]".
4. **Canon check on a phase-0 PR** (GitHub PR look, a comment from the Omni App's inbox check): "Breaks a Never line: written for a 6-entity holding; our customer is 2–50 people", buttons "Rewrite for Marc" / "Change the claim".
5. **Game mode on**: the one promoted idea gets a VS card: Marc vs Procore, three cited ticks, no percentage.

## H' — The read path (thin H)  [letter C]
Grew from: H "Product Brain", thinned to the pipe.
Person's note: keep H. Panel note: 5 of 6 would fold it into A' as its read slice; the Skeptic would keep the MCP URL as its own small PRD because a read-only revocable token is new auth work.
Screens (3–5):
1. **Terminal**: `omni business show` on an empty workspace prints "No business yet — agents carry on." exit 0; on a filled one prints the confirmed claims with receipts; `--json` shows the exact same fields the MCP returns.
2. **"Connect an agent" row** on the Business page: copy the MCP URL + a read-only, revocable token (name it, see last used, revoke); snippet tabs for Claude Code / Cursor.
3. **Cursor chat pane** (an editor-like look): the user asks "who is our customer?"; the answer arrives citing claim ids and receipts; a second question ("do we sell in Luxembourg?") gets "Not known yet — sent to the Business page".
4. **Back on the Business page**: "3 questions agents couldn't answer" as unknown rows, each naming who asked ("think-big on vertuo-app", "Cursor · Tom"), with "Answer once".
