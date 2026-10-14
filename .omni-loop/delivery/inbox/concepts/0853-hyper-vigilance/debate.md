# Debate — concept 853, Hyper Vigilance

The studio's turns, round by round and by role, dissent included. Kept by the moderator.

**The brief.** A senior engineer who distrusts agent-written code chooses Omni Loop for real work.
Objections to beat: quality ("slop, I rewrite it anyway") and control ("agents touch my code
without me"). The game is out of scope.

**The studio.** Concept artists: 10×, steal from another industry, delight, contrarian. Panel:
Visionary, Craft, Skeptic, Value, User (the owner: the grumpy senior engineer), User (the PM who
drives the loop). Moderator: the main session, never votes.

## Round 1

### Turn 0: opening positions

**Visionary.** The screenshot test: would a grumpy senior send it to a peer with "look what it caught"? Rewards the engineer named at the centre (their paths, their veto, their rules), proof over promises (surviving mutants, rework and reverts on the diff, scored by the skeptic's own ratings, as Tricorder and Renovate), one memorable mechanic (trust earned area by area, an andon stop, review shrunk to the three risky hunks), and an agent that visibly learns from one review comment. Punishes dashboards nobody opens, self-awarded quality badges, more walls of comments, touching the game or cutting steps, safe copy tweaks. "Evidence, not reassurance, is the wow."

**Craft.** Rewards concepts that live where the engineer already reads code (the diff, the review thread, the terminal), with every agent change answering what / why / what next in the same place every time; evidence over prose; the empty and error states designed first (no data yet, agent wrong, check red, law broken); one-keystroke answers; the density a senior expects. Punishes dashboards nobody opens, unsourced confidence badges, playful copy (introFun) in a review of their code, motion for its own sake, any number shown before it exists (P-PRODUCT-7), anything touching the game.

**Skeptic.** Rewards the engineer as the judge of quality through evidence they can check: surviving mutants on the diff; a per-area track record (rework, reverts, "not useful" rate) computed from git, not claimed by the loop; CODEOWNERS routing so nothing lands in their paths without them; review sized to one sitting; a per-area automation level the engineer sets and the loop never raises itself. Punishes scores with no ground truth, rationales standing in for tests, anything that adds review load without removing more, medium decisions still adopted silently, any surface that makes them leave GitHub or the terminal. "Every concept owes me: what must be true, and the smallest proof."

**Value.** Scores one thing: does the owner's behaviour change (starts a PRD or fix, merges without rewriting, defends it to a peer)? No business claims this run, so a concept citing numbers loses points. Rewards a payoff on the owner's first PR before any trust is asked, self-checkable evidence, falling review time per merged change, value that spreads peer to peer. Punishes reassurance without proof, new surfaces that add review load, concepts that serve the PM while the owner watches, value only at full adoption, touching the game or cutting a gate.

**User, the owner.** "I own this code and carry its pager. Win me with proof I can check, not claims: tests that fail when I break the code (surviving mutants on the diff, in the PR), a rework-and-revert record per area I can audit, slices I can review in five minutes that say what they did, why, and what next. Let me mark which paths are mine, see every slice touching them before code, and teach a rule once in review so it sticks. I walk away from a dashboard I have to visit, a confidence score I can't trace, and medium decisions adopted in my area while I'm on call. If it's not faster than writing it myself, I'll write it myself."

**User, the PM.** "Put my engineer's name in the loop, not 'a person'. Route each slice to whoever owns those paths, let them reshape the plan before code, and put proof on every sub-PR: tests that bite, rework and revert numbers they can check. If a rule they teach once binds the next slice, they stop rewriting. What would cost me too much: a new gate where yolo waits on a busy senior's calendar, a second tool to learn on my phone, or product questions routed away from me. Their control over their code, yes. A veto over my week, no."

### Turn 1: open (each panelist on A–H)

#### Visionary



My question for each concept: would a grumpy senior screenshot it and send it to a peer? Five of the eight pass: C, B, G, D and E. F is the one I call the safe version.

##### A
reaction: The best moment in the card is not the pinned test file. It is "your red leaves one door open": the loop runs mutants against the owner's own assertions and finds the missing `homeAge === 10`. A skeptic would forward that because the loop out-tested them, politely. But requiring the owner to write every red in their paths makes the skeptic do the chore they already resent, and the agent ends up a typist.
remix: Yes, and turn it into a sparring match. Before building, the agent bets on which mutants the owner's red will miss, and it is right about the 10-year boundary. The owner keeps authorship of the proof, and the agent earns respect as a critic of tests rather than a writer of them. Offer it as F's "hands off" level, not as the default everywhere.
scores: wow 4, value 3, craft 4, fit 4
stance: Keep the "door left open" finding and fold it into F's "hands off" level. Don't make it the headline mechanism.

##### B
reaction: "Nothing for you to fill in: your rewrite was the claim." That line turns "I rewrite it anyway" from an objection into fuel, and it is the most emotionally accurate answer to the brief. A tool that files claims against itself, drafts R-BILLING-4 from a diff and demotes itself in billing/ is the story an engineer tells at lunch. The weakness is timing: the payoff arrives 19 days after the merge, not on the first PR, as the Value critic asked.
remix: Yes, and make the claim public. When the owner rewrites its lines, the loop posts its own incident report as a comment on the old sub-PR (#1436): what it got wrong, the rule it now follows, and the 23 breaches it will fix after the owner's "y". A tool that writes its own post-mortem where the whole team can see it is the screenshot. The drafted rule then quotes the owner's commit message word for word (D's mechanism).
scores: wow 5, value 4, craft 4, fit 5
stance: Champion. This is the learning spine, and it should merge with D so a rewrite and a review comment feed one memory.

##### C
reaction: "612 lines by the loop · the 4 that decide, by their owner" is the line of the round, and the blame view proves it rather than claims it. Finding that the PDF and the Peppol export already disagree, with three real invoices under each choice, shows the loop knows the codebase better than the engineer expected. That moment wins the engineer over. It answers both objections at once: no guessed value where it matters, and the owner's name exactly where authority belongs.
remix: Yes, and let G's double reading find the deciding line. Wherever two blind builds disagree on a real fixture, that disagreement is the owner's line: the gap in C is not an agent's hunch but a measured split (€12.60 against €12.59). C is the surface and G is the engine, and the owner's "e" becomes the tie-breaker the two builds could not settle.
scores: wow 5, value 4, craft 5, fit 5
stance: My top pick. Build the crowned concept around this moment.

##### D
reaction: "Said once. Held in 11 agent diffs since, in folders you never reviewed." Seeing your own words govern agents you never met is flattering and useful, and it fills the gap the fuel sheet names: knowledge taught in the flow of review. Mining years of human review history means it pays off on the first PR, which passes the Value critic's test. The risk is a margin full of notices that turns into noise; the "Not useful" button has to have teeth, Tricorder-style.
remix: Yes, and let the owner's words guard human PRs too. When a colleague's hand-written PR breaks R-API-14, the same quiet check quotes the owner. At that point the skeptic stops being the loop's critic and becomes its champion, because the loop is now the enforcer of their standards across the team.
scores: wow 4, value 5, craft 4, fit 5
stance: Strong, and it pairs with B. Rules come from what owners say (D) and from what they redo (B).

##### E
reaction: "Unpaid" is a great word, and "the only lines I actually read were the two it couldn't pay for" is a real promise about review time. The per-line receipt (test that fails, precedent in our code, the spec or rule it serves) is the most rigorous anti-slop idea on the table, and "38 of 612 receipts not useful" lets the skeptic grade the loop. My worry is that a hover layer on every line is instrumentation, not a moment. People would admire it but not forward it.
remix: Yes, and make the bill the headline. Every feature PR opens with one number: "this PR costs you 7 lines of reading." The loop's job is to drive that bill down wave by wave by rebuilding what it cannot pay for, and the trend of that number per area becomes the Waymo-style public metric of trust.
scores: wow 4, value 5, craft 5, fit 4
stance: The best evidence layer. Keep it as the foundation under C, not as the crowned concept on its own.

##### F
reaction: Levels of autonomy per code area is the answer everyone expects, and that makes it the safe version. The spark is "the agent asked me for a promotion, backed by its record from git", and the "STOPPED AT YOUR BORDER" block is a strong answer to "without me". To the Owner: `omni turf` is a place you have to go visit, and you said you walk away from those.
remix: Yes, and make the promotion a pull request. The agent opens a one-line PR against a checked-in `.omni-loop/turf.yml`, the owner reviews it like any code, and "n, not until #858 lands" is a review comment kept in git. Trust as code, audited by `git blame`, not by a dashboard.
scores: wow 3, value 5, craft 4, fit 5
stance: The necessary frame, not the headline. Crown it only if it carries a C or B moment inside it.

##### G
reaction: This is the most surprising mechanism in the round. Two blind builds, €12.60 against €12.59, "A matches 41 archived PDFs, B matches 29", and "B's test fails on A: a hidden bug". It proves tests prove nothing ("A's tests pass on B, so none of them pins the rounding") in one line, better than any mutation report. The cost is double compute, and it does nothing for style.
remix: Yes, and feed each disagreement to C. The discordant input becomes C's deciding line in the owner's code, the owner's pick becomes the approval test, and the concordant 38 hunks fold away unread. The two blind builds are the evidence that a line is the owner's to decide.
scores: wow 5, value 4, craft 4, fit 4
stance: Champion, merged with C. Don't let it be judged alone on cost.

##### H
reaction: "I have control. You have control." is a ritual engineers would quote. `omni take s4` freezing at the last green commit with a doing/why/next/unsure brief is the cleanest answer yet to "agents touch my code without me". But it assumes the owner is around while the slice is being built, and the skeptic does not want to babysit a cockpit. The card shines when they grab the controls and fades when they don't.
remix: Yes, and put the handover brief (doing, why, next, unsure) at the top of every agent PR, always in the same place, whether or not anyone takes control. That is NASA's three questions made standard, and `omni take` stays as the emergency verb, one keystroke from any PR.
scores: wow 4, value 4, craft 4, fit 4
stance: Keep `take`/`give` and the brief as the control verbs. They are strong supporting pieces, not the crowned concept.

---
My ranking: C > B > G > D > E > H > F > A.

Two merges I'll push:
- **C+G, "the owner's line".** Two blind builds locate the one line that is yours to decide.
- **B+D, "said once, rewritten once".** The loop learns from your words and your rewrites, and owns its misses in public.

F and H are the frame they both need. A lives on as one level inside F.

#### Craft



##### A
reaction: A strong card. It lives in the GitHub PR. The one surviving mutant sits in a single amber callout with a line jump. The inline "never tries 10" chip on line 8 puts the evidence exactly where the eye already is. What the card leaves out is the state that matters most: four `it.todo()` stubs and an owner who is on call or on holiday. The happy path is drawn, but the waiting state, where the wave stalls on the owner's calendar, is not.
remix: Yes, and the waiting state becomes a designed screen. `omni red s3` opens the test file in the owner's editor at the first `it.todo()`, with their builders already imported. Each stub gets a `g` key, "let the agent write this one", and the pin check then marks that line agent-written. The owner writes the reds that matter, and the wave never stalls without saying so.
scores: wow 4, value 4, craft 4, fit 4
stance: Keep it. It is the sharpest answer to "tests that prove nothing", provided the stalled state is drawn as carefully as the green one.

##### B
reaction: The rewrite itself is the input ("nothing for you to fill in"), and that is the best zero-effort interaction in the set. The split diff, the drafted R-BILLING-4, the y/e/n keys and "n just my taste, don't learn it" are all deliberate. Two things are off. First, it is a surface the owner has to go to (`omni hook`). Second, "lines still as the loop wrote them" also counts ordinary change as rework, and the card never draws the case where a rewrite was a new requirement rather than a correction.
remix: Yes, and the claim arrives on the owner's own rewrite PR as an `omni/on-the-hook` check comment, with y/e/n as reply commands. Add a fourth key, `r`, for "the requirement changed, this wasn't a fix", so a feature change never counts against the loop and the 94% / 71% figures stay honest.
scores: wow 4, value 4, craft 4, fit 4
stance: Keep it. Move the claim to where the rewrite happens, and give the honest "not a fix" key before the numbers are trusted.

##### C
reaction: My favourite in the set on craft. There is one marked hole. The approval test runs on three real invoices, amounts aligned right in fr-BE format, so the 0,01 differences jump out. "Your code already disagrees with itself" is evidence, not a rationale. The hand-off between surfaces is drawn too: a keystroke in the terminal leads to `git blame` on GitHub four minutes later, and the ready bar reads "612 lines by the loop · the 4 that decide, by their owner". It only works while the holes stay rare, and the card does not say what caps them.
remix: Yes, and the wave keeps building around `owner('vat.rounding')` with the tests for both options in place. When she answers, the losing branch deletes itself, so the diff she reviews is her line and nothing else. Add a cap: if a plan would leave more than two holes in one owner's paths, the phase-0 PR asks her before any code. "One line waits for you" must never become "eleven lines wait for you". The empty state says plainly "nothing waits for you".
scores: wow 4, value 5, craft 5, fit 5
stance: This is the one to build on. The decision stays with the owner, the evidence uses real fixtures, the answer takes one key, and it is today's outbox with the owner's name on it.

##### D
reaction: Quoting the owner in their own words, inline, with a "Not useful" button, is a strong emotional hook. "Keep, as written / Just #841" with a scope chip is a clean two-choice capture. On density it fails, though. It annotates compliance: each line that *followed* a rule gets a quote, and on a 40-file diff that becomes the wall of comments this brief is meant to kill. It is reassurance, not evidence. Mining years of review history also needs a conflict state that is not drawn: two of her old comments disagree, or her comment clashes with a peer's.
remix: Yes, and flip the annotation. Quote her only where the diff *would have* broken the rule and was rebuilt ("first attempt threw from the handler; rebuilt to hold R-API-14"). Compliance collapses to one summary line: "held 3 of your rules, 0 departures". When the harvest finds her own comments disagreeing, it asks which one wins before either becomes a rule.
scores: wow 4, value 4, craft 3, fit 5
stance: Keep the harvest; it closes the "taught in review" gap exactly. Cut the annotations down to the exceptions, or Tricorder's noise bar sinks it.

##### E
reaction: The strongest evidence surface in the set. The header gives the review list outright ("2 unpaid, read these: decide.mjs:45 state.mjs:88"). The single unpaid line is the only yellow on the page, and it offers three plain actions: Make it pay, Cut the line, I'll write the test. The Tricorder rate is shown as a real count (38 of 612 not useful). Two gaps. Deleted lines carry no receipt, and a removed guard is where bugs hide. The "follows our code" receipt is a sentence ("same shape"), exactly the kind of plausible, unfaithful rationale the radiology reference warns about. The per-line T/P/L chips and the popover are also chrome GitHub does not offer; the honest version is check annotations.
remix: Yes, and deletions have to pay too. Each removed line shows the test proving it was not load-bearing, or it is flagged unpaid. The P receipt opens as a side-by-side of the two snippets, so the owner judges the resemblance instead of reading a claim about it.
scores: wow 5, value 5, craft 4, fit 4
stance: This is the slop answer. Make the precedent checkable and receipt the deletions, and it becomes the default face of every sub-PR.

##### F
reaction: The "no record yet: claimed today" row is the empty state actually drawn, and the promotion panel spells out grants / keeps / revokes before the owner presses `g`. That is annunciation done right: what changes if I say yes. "Stopped at your border" with "PM sees: s4 with @pderval since 14:02" designs the waiting state A leaves out. Two problems. The colour semantics are inverted: "hands off" is drawn in alarm red, so the owner's sovereign choice looks like a fault. And the promotion ask waits inside a screen the owner has to visit.
remix: Yes, and the promotion arrives as one review comment on the 23rd clean sub-PR, the one that earned it, with g/n as reply commands. The levels lose the alarm colours: "hands off" takes the owner's colour, and red is kept for the one state that really is a fault, a revert that lowered the level.
scores: wow 4, value 5, craft 4, fit 5
stance: This is the backbone of the set. Ship it as the dial the other concepts obey, not as a place to go.

##### G
reaction: "The smallest input where they part" (3 lines × €19.99, €12.60 against €12.59, set big in a neutral blue/pink pair that does not favour either build) is the best single piece of evidence on any card. The cross-test panel ("A's tests pass on B, so none of them pins the rounding") is a real insight. But it asks a question its own evidence already answers: 41 of 41 archived PDFs match A. "Keep A / Keep B" on style spends the expert on what the knowledge base should settle. The 38 concordant hunks also show as reassuring green, when two models can share the same mistake. And the "Double reading" PR tab is a pixel GitHub cannot draw.
remix: Yes, and the loop uses its evidence before it asks. Where the archive or the spec decides, it picks and shows why, and the owner arbitrates only true ties. Concordance is labelled "agree", not "verified", in grey rather than green, with one line saying that two builds can share an error. The panel lives in the check run's summary, where GitHub actually lets it live.
scores: wow 4, value 3, craft 4, fit 3
stance: Steal the smallest-input panel for C and E. As a concept it doubles the cost and still overclaims agreement.

##### H
reaction: The mode strip ("who flies, what, now") is mode annunciation made literal: always visible, always in the same place. The doing / why / next / unsure brief is the NASA question set plus the one it forgot. Time-boxed grants ("until 15:00") and callouts for territory slips during the owner's edits are deliberate touches. The transition that matters is not drawn: what happens to the agent's uncommitted work when it "froze at its last green commit". Is it discarded, stashed or replayed? "ARMED" is jargon an engineer will not parse, and the "I have control" call-and-response belongs in the log, not in the prompt output.
remix: Yes, and `omni take` names what it parks: "parked: 2 files, +40, on stash s4-agent-3". Taking control never silently throws work away, and `give` offers to replay it. A `/take s4` review comment does the same from the PR, because the owner is often reading the diff, not sitting in the terminal.
scores: wow 5, value 4, craft 4, fit 4
stance: Keep the mode strip and the handover brief whatever wins. Draw the parked-work state before round 2.

##### Across the set
- **F is the dial; A, C, E and H are what each notch does.** Hands off = A (the owner writes the red). Ask first = C (the owner writes the deciding line). Show me first = E (receipts, review the unpaid lines). Build, tell = today's loop, with H's `take` always one command away.
- **None of the cards uses introFun copy.** Keep it that way on every engineer-facing surface.
- **Pixels that cannot exist are not deliberate.** E's gutter chips and popover, and G's PR tab, need their honest home (check annotations, the check-run summary or the Omni page) in round 2.

#### Skeptic



My question to every concept: what must be true for it to work, and what is the smallest proof? This is round 1, so nothing is vetoed on cost and Feasibility isn't scored yet.

##### A
reaction: A is the best answer on the board to "tests that prove nothing". The owner's red is pinned byte for byte and mutation runs on *their* assertions, so the agent can't grade its own homework. Two things must be true. First, writing the red must be clearly cheaper than writing the slice: for vat.ts the tests are close to half the work. Second, "turn red green" must not invite code that fits four assertions and nothing more, because mutation on the owner's red finds holes in the tests, not an implementation overfit to them. It also puts the owner's calendar on the critical path, which is the "veto over my week" the PM refused.
remix: Yes, and make it one of F's levels ("I write the red"), chosen by the owner per path rather than set as the default. The agent may also propose the missing boundary case (a home aged exactly 10) as a suggestion the owner accepts into *their* file with one key, so the file stays theirs and the gap gets closed.
scores: wow 4, value 3, craft 4, fit 4
stance: The strongest proof of test quality here. I back it as an opt-in level, not a gate on every owned slice, until one owner times writing the red against writing the whole slice by hand.

##### B
reaction: B is the only concept whose evidence is what happened after merge, not an argument made before it. The owner's rewrite *is* the rating, which is the ground truth I asked for, and it costs them nothing to file. What must be true: authorship must survive the trip to main. A squash-merged feature PR blames whoever merged it, and reformatting or moving code hides the rest, so the loop needs its own record of which lines it wrote (a line ledger), not `git blame`. A rewrite must also be told apart from a changed requirement, or claims become noise (Tricorder's bar is under 10% "not useful"). Drafting a law from a single diff is a guess, but kept proposed until the owner presses "y", that's acceptable.
remix: Yes, and run it on the past first. Compute "lines still as the loop wrote them after 60 days" for every PRD this repository has already shipped, so the owner's first screen shows real history, not a promise. That answers Value's "payoff on the first PR". Then let B's claims be what lowers F's level.
scores: wow 5, value 4, craft 4, fit 4
stance: My top pick for building trust. The smallest proof is that ledger computed over omni-loop's own shipped PRDs, before any UI.

##### C
reaction: Excellent on control. The loop stops at the one line that decides, shows each option on real invoices, and the owner's name lands in blame exactly there. The `p` key keeps product questions with the PM. What must be true: the agent must recognise the decision in the first place, and the dangerous decisions are the ones it never noticed it was taking. A corpus of real, anonymised fixtures must also exist, and the loop must be able to match code in two languages as "the same computation" (VatCalculator.php against ubl.ts). C does nothing for the other 608 lines, so slop is untouched.
remix: Yes, and let G find these lines instead of relying on the agent's own report. Wherever two blind builds diverge, nobody settled the decision, and that is the line C leaves for the owner.
scores: wow 5, value 4, craft 5, fit 4
stance: I back it. It turns a high outbox item into code the owner signs, but it needs a way to find decisions that doesn't depend on the agent knowing what it doesn't know.

##### D
reaction: D fills a gap the fuel sheet names (knowledge taught in the flow of review, not drafted by /omni:invade), and mining years of review history pays off on day one, as Value asked. What must be true: the mining must be precise, or the owner spends an afternoon rejecting candidates, which is exactly the review load I said I'd punish. "Held" must also be proven, not claimed. Today it is the agent judging its own diff against an English sentence, which is a self-awarded badge.
remix: Yes, and turn every rule that can be mechanised into a check (ast-grep, an ESLint rule or a test). "Held" then means that check ran and passed, with the owner's quote as its message. Only rules that can't be mechanised keep a visible "judged, not checked" label.
scores: wow 4, value 4, craft 4, fit 5
stance: Yes if "held" means a check ran. No if it's the loop's say-so in a nicer font.

##### E
reaction: The T receipt (a mutant on this line that the tests kill) is real evidence. P (a precedent in this repository) and L (the spec line or law it serves) come from retrieval: explanations that sound right, checkable with a click but claimed by the tool. That is the radiology heatmap trap from the fuel sheet: explanations that look right but aren't faithful. Two things must be true. `mutation` must be configured and fast on changed lines, and today the config defaults it to `null`. And "paid" lines must really be safe, because "read only the unpaid lines" trains the owner to rubber-stamp the rest. A killed mutant proves a test pins the line, not that it pins the right value.
remix: Yes, and audit the receipts after merge. Publish, for each receipt kind, how often a "paid" line was later rewritten or reverted (using B's ledger), and drop any kind that misses the bar, as Tricorder drops checks.
scores: wow 4, value 4, craft 5, fit 4
stance: I back the T receipt and the "Not useful" button. P and L must show a low post-merge miss rate before "read the unpaid lines" becomes the instruction.

##### F
reaction: This is my opening position on one screen. The engineer sets the level per area, a revert lowers it automatically, only the owner raises it, and the record is read from git. Three things must be true. Turf must exist without CODEOWNERS, because this repository has no CODEOWNERS file, so claimed paths have to work on their own. The record must be honest, which is B's authorship problem again. And a slice touching two turfs must be split or routed without stalling the wave. "Hands off" and "show me first" put the owner on the critical path, but the card keeps s1–s3 moving, which is the right answer to the PM.
remix: Yes, and make F the frame the others plug into. B supplies the record and the demotions, A becomes a level ("I write the red"), and H is how the owner acts on any level mid-build. A promotion request should show only numbers the owner can recompute with one command.
scores: wow 4, value 5, craft 4, fit 5
stance: My strongest backing on control. On its own it's a settings page: its record is only true once B's ledger exists, so I want the two together.

##### G
reaction: The real invention is running each build's tests on the other. B's test failing on A found a bug neither build shows alone, and "A's tests pass on B, so none pins the rounding" proves a weakness in the tests that nothing else on the board can show. What must be true: the two builds must fail independently, and they won't. Same model, same spec and same repository mean they share the same mistakes (the classic finding against N-version programming, Knight & Leveson). So "38 concordant hunks, folded" presents weak evidence as strong. The real oracle on the card is the 41 archived PDFs, not the second agent.
remix: Yes, and use G to find decisions and critique tests, not to verify code. Never fold agreeing hunks as "checked", make the two builds as different as possible (a different model or approach), and put a real oracle (archived outputs) in front whenever one exists.
scores: wow 5, value 4, craft 5, fit 4
stance: Keep the cross-tests and "each difference becomes a test". Reject agreement between the builds as evidence until someone shows that two agents' errors don't coincide.

##### H
reaction: H is the most direct answer to "agents touch my code without me". The owner can take any slice mid-build, the agent freezes at a green commit, and every handover is logged. Two things must be true. The owner must be present during the build to notice and take over, and most won't be, so H is an escape hatch, not a daily habit. And "no agent writes in your paths without a handover" means a `give` per slice, which is the calendar gate the PM refused unless time-boxed grants (as on s3) are the norm. The "~40 min" on s5 is also a guessed value, which P-PRODUCT-7 forbids showing.
remix: Yes, and put the handover brief (doing / why / next / unsure) on every sub-PR, whether or not anyone takes control. NASA's three questions, always answered in the same place, are the cheapest win here.
scores: wow 4, value 4, craft 4, fit 4
stance: I back take/give and the brief. Drop the "I have control" callout ritual if the owner finds it cute. Craft warned against playful copy in a review, and I agree.

##### To the panel
- **Value**: B and D are the two that pay off before any trust is granted, provided B is run on history first.
- **PM**: A, H and F's "hands off" are where your "veto over my week" risk sits. C's `p` key and F's parallel carry-on are the models to copy.
- **Owner**: your "rework-and-revert record per area I can audit" is B's ledger feeding F. Nothing else on the board computes it.
- **Visionary**: C and G pass your screenshot test. B passes it only if its numbers are real on day one.

My cut: B and F are the trust spine (ground truth after merge, a level per area). A, C and G supply evidence that the tests bite and that the owner owns the decisions. D and E stand or fall on whether "held" and "paid" come from checks that ran, not from the loop's own claims.

#### Value



My test across all eight: does it cost the owner any new chores? The ones I rank highest take something the owner already does (rewriting, review comments, a decision) and turn it into leverage. The ones I rank lowest add writing, watching or arbitration in exchange for trust. Building on User (the owner)'s opening: they asked for four things, and each is fully met by one concept here. D is "teach a rule once", E is "surviving mutants in the PR", B and F are the "per-area rework and revert record", and H is "if it's not faster, I'll write it myself".

##### A
reaction: A removes "tests that prove nothing" at the root, and the pinned red is proof the owner can check byte for byte. But it moves work onto the owner: in their own paths the wave waits for them to write the red first, so the loop's leverage shrinks exactly where the code matters most. It makes "merges without rewriting" more likely and "starts a PRD on their own" less likely.
remix: Yes, and each pinned red becomes an asset that keeps paying: it goes into the area's knowledge as a spec by example, so the next PRD in src/quotes/ opens with the owner's reds already there, and a red written once pays for many slices.
scores: wow 3, value 3, craft 4, fit 4
stance: Honest about quality but expensive in owner time. It works as an opt-in tier for critical paths, not as the default.

##### B
reaction: This is the only concept where the skeptic does nothing new and the loop still gets held to account. "Your rewrite was the claim" turns "I rewrite it anyway" from a complaint into input for the loop's learning. The record of how many of the loop's lines still stand after 60 days, per area, is exactly the auditable record the owner asked for. Its weakness is timing: the payoff comes after merge, so it does not lighten the first review.
remix: Yes, and make that line-survival rate the one number printed on every feature PR for the paths it touches ("the loop's lines here: 88% unchanged at 60 days"). That is Renovate-style merge confidence built from the owner's own behaviour, and it is the line a skeptic can quote to a peer.
scores: wow 4, value 4, craft 4, fit 4
stance: The best learning engine in the set. I want it as the feedback spine under whatever wins.

##### C
reaction: The owner spends four minutes on the four lines that decide, and the loop takes 612 lines off their hands. That is the right exchange rate, and it follows P-PRODUCT-7 (no guessed value) all the way into code. The "your code already disagrees with itself" finding matters regardless of whether the owner trusts agents, so it is something the skeptic will retell. Its value depends on how often the loop correctly catches an undecided line: too often and it nags, too rarely and it guesses silently.
remix: Yes, and each answered line becomes a proposed law for that area, so the same question is never asked twice. Then show the number of asks per area going down over time; that falling count is the evidence the loop is learning from its owner.
scores: wow 4, value 4, craft 4, fit 5
stance: The strongest answer to control, but its payoff comes in episodes. It should be a feature of the winner, not the whole spine.

##### D
reaction: D has the best business shape in the set. The payoff lands on the first agent PR because it mines years of review history, so the owner gets something before granting any trust. It costs them no new chore. It also scales one senior's judgment across every diff: "held in 11 agent diffs, in folders you never reviewed" is the owner's reach made visible. The "Not useful" button keeps it honest in the Tricorder way; the risk is rule sprawl and quotes taken out of context.
remix: Yes, and let the confirmed rules also run as the same quiet check on human PRs in the owner's paths. The loop then earns its place on days no agent is building, and the skeptic starts using Omni Loop before trusting a single agent line. (This widens the scope, so I am flagging it for the Skeptic to weigh.)
scores: wow 4, value 5, craft 4, fit 5
stance: My top pick for "chooses it on their own". It answers the style and slop objection in the owner's own words and pays off on day one.

##### E
reaction: E pulls the lever that decides the outcome: reading time per merged change. "The only lines I read were the two it couldn't pay for" is the one sentence that makes the loop faster than writing by hand. The receipts are traceable evidence (a killed mutant, a file:line), not a score, which clears the owner's "no confidence score I can't trace" bar. The one soft receipt is the precedent: a plausible look-alike is the unfaithful-saliency trap the radiology reference warns about.
remix: Yes, and track the count of unpaid lines per sub-PR per area as a trend, the way Waymo reports disengagements. Let the owner's "not useful" marks retire a receipt kind in an area, so the quality record is both graded and pruned by the expert.
scores: wow 4, value 5, craft 5, fit 4
stance: The best answer to the quality objection and the biggest review-time win. I want it in the final concept.

##### F
reaction: F is the adoption ramp. A skeptic can start at "show me first" and let the record earn a promotion, which is how a critic becomes a champion without a leap of faith. The per-area record read from git answers the owner's audit ask directly. Two cautions: it is the least surprising idea here, and a turf table the owner must remember to visit is the "dashboard I must go visit" they said they would walk away from.
remix: Yes, and fold B into it: rewrites, not just reverts, count against the record automatically. The promotion request should also appear where the owner already is, as one line in the feature PR they are reviewing, not a terminal command they have to remember to run.
scores: wow 3, value 4, craft 4, fit 5
stance: The structure that A, B, C and H can plug into. Low wow, high structural value.

##### G
reaction: €12.60 against €12.59 is the most visceral moment in the set, and the cross-tests that expose hollow tests are real evidence. But two builds from the same kind of agent can share the same blind spots, so their agreement risks becoming false confidence, and it doubles the building for every slice in the owner's areas. The payoff depends on an oracle (archived PDFs, computable money); outside money and stored shapes it weakens.
remix: Yes, and double-read only the slices a risk score flags (money, stored shapes). Treat agreement as evidence only when both builds also match the owner's own archived real outputs, never when the builds merely agree with each other.
scores: wow 5, value 3, craft 4, fit 3
stance: A brilliant demo with a narrow payoff. It is a tool for high-risk slices, not the spine.

##### H
reaction: H gives the best reply to "if it's not faster, I'll write it myself": then write it, while the loop keeps everything else moving and monitors your diff. That makes the loop the owner's workbench rather than an outside vendor. The cost is attention: control requests arriving mid-afternoon are interrupts, and the three-callout handover adds ritual, even though ceremony is not the complaint the brief names.
remix: Yes, and let "take" also work from a review thread: the owner comments "mine" on a sub-PR, the slice freezes at green and the handover brief lands right there, so control does not depend on being at a terminal mid-build.
scores: wow 4, value 4, craft 4, fit 4
stance: Strong on control and speed. It works best as the escape hatch inside F's levels rather than as a concept of its own.

##### Across the set
The concepts cluster. D and E pay off on every PR from day one; B and F build the checkable record over time; C and H hand the owner the wheel exactly when it matters. My early bet is a D + E core, with B's survival record as the proof the owner shows a peer.

#### User, the owner



##### A
reaction: Pinning my test file byte for byte and aiming the mutants at my own assertions is the first time a tool has taken "tests that prove nothing" seriously, and "never tries 10" is exactly the bug I'd ship. But on a Monday with the pager on, writing the red for every slice in src/quotes/ makes me the wave's bottleneck, and most of what lands in my paths is glue that doesn't deserve a hand-written red. I'd use it on the money code, not everywhere.
remix: Yes, and when my red leaves a door open, let the agent draft the missing test as a suggestion on my file that I accept with one key and that then carries my name. It stays my red; I just don't have to type it.
scores: wow 4, value 3, craft 4, fit 3
stance: Yes for the handful of paths I name (VAT, totals); a tax if it's the default across my turf.

##### B
reaction: This is the only concept that turns what I already do, rewriting its code, into the feedback with nothing to fill in, and "a float never holds money", drafted from my own diff, is the rule I'd have written. "Lines still as the loop wrote them, 60 days on" per folder is a number I'd trust because it comes from git, not from the loop's opinion of itself. My worry is attribution: half my rewrites happen because the requirement moved or I renamed things, and a loop that files claims against itself for my refactors becomes noise.
remix: Yes, and ask me one key on each claim (bug, taste, or the spec moved), count only "bug" against its record, and let a page traced to its lines count without asking me anything.
scores: wow 5, value 4, craft 4, fit 4
stance: The strongest answer to "I rewrite it anyway". I want it under whatever wins, as the thing that keeps the score honest.

##### C
reaction: This is how I want to be asked: one line in my code, three real invoices under each option, and the two places our code already disagrees with itself. That last part alone is worth it; I'd never have found the PDF/Peppol drift before a customer did. It guesses nothing, it leaves VatCalculator.php alone and tells that file's owner, and blame shows my name on the lines that decide. Everything rests on spotting the real decision: leave me twenty of these a week and I'm back to writing it myself, miss the one that matters and it's today's loop.
remix: Yes, and put a blast radius under each option: how many of last year's real invoices change total, and by how much in euros, so I pick on evidence and not on three samples.
scores: wow 4, value 5, craft 5, fit 5
stance: My favourite so far: a small ask of me, a big lever, and my name where it counts.

##### D
reaction: This is what I asked for in my opening, teach it once in review and it sticks, and quoting me word for word is right, because a reworded rule is a rule I didn't write. Mining my review history so the first agent PR already follows me is a smart cold start. But "held in 11 agent diffs, in folders you never reviewed" makes me nervous: my rule in someone else's apps/api/ is me overruling a colleague through a bot.
remix: Yes, and let rules go stale on purpose: a rule no diff has touched in 90 days, or one I've marked "not useful" twice, comes back to me to keep or retire, so my 2024 comments don't turn into dogma.
scores: wow 4, value 5, craft 4, fit 5
stance: Yes, scoped to my turf by default, and wider only when the other owner confirms too.

##### E
reaction: Evidence in the diff, line by line, graded by me: this is the one I'd defend to a peer. "2 unpaid, read these" tells me where to spend my five minutes, and the surviving mutant M9 is exactly the hollow test I'd otherwise miss. Showing me my own "not useful" rate (38 of 612) means the loop keeps score on itself where I can see it. My pushback is "precedent": half our repository is code I'd never want copied, and a receipt that points at legacy/ is a receipt for slop.
remix: Yes, and only accept a precedent from code that has stayed untouched and unreverted for months and that I haven't flagged (tie it to B's record), so a receipt can never cite the code I'm trying to get rid of.
scores: wow 5, value 5, craft 4, fit 4
stance: My top pick for quality. I'd still skim the paid lines in money code, but I'd stop rewriting.

##### F
reaction: It's the control panel I expected: my paths, my level per path, and only I raise it. The promotion request that comes with its own record from git (21 of 23 approved as they were, 0 reverts) is the right way round: it asks with evidence, and I answer "not yet, because". "Hands off" on migrations, with the PM seeing "s4 with @pderval since 14:02", is honest about what my control costs the team. On its own it doesn't make the code any better, it only gates it, and "show me first" still means I review every sub-PR.
remix: Yes, and set the level per function as well as per path: let it "build, tell" the code in kit/lib/care while its medium decisions there stay "ask first", and let B's claims lower the level, not only reverts.
scores: wow 4, value 5, craft 4, fit 4
stance: The control backbone. I'd want it under whichever quality concept wins.

##### G
reaction: €12.60 against €12.59, checked against 41 of our real invoice PDFs, is the most convincing single screen here, and running each build's tests against the other build is a clever way to show that a test pins nothing. But it means two builds and 1,200 generated inputs per slice. That works for pure money functions and is theatre for a route handler or a form, where every disagreement is style. Three things to arbitrate per slice on a Monday is also three more than I want.
remix: Yes, and don't make it a mode; make it how C finds decisions. Run the second blind build only in my critical paths, and when the two builds disagree on behaviour, that's the "your line" the loop leaves me, with the invoice where they split already pinned.
scores: wow 5, value 3, craft 4, fit 3
stance: A brilliant tool for pure calculation code and wrong as a default; best folded into C.

##### H
reaction: The doing / why / next / unsure brief is the part I'd use every day, and freezing at the last green commit is the right way for an agent to get out of my way. But the idea that I'm watching a slice live and grab the controls halfway through doesn't match my day: I'm in review or on the pager, not watching agents in real time. The ritual phrases on the exchange log are cockpit cosplay; the strip of who holds which slice is the part I'd keep.
remix: Yes, and let me take a slice from the plan before it starts, not only mid-flight. When my pager fires, every slice I hold gets its brief written and goes back to the agent automatically, so an incident never leaves a slice frozen on me.
scores: wow 4, value 3, craft 4, fit 3
stance: Put the brief and the who-holds-what strip everywhere; `omni take` I'd use twice a quarter.

**Where I stand after round 1:** E for quality and F for control, with B keeping the record honest and C as the way I'm asked. D is the cheapest win. A, G and H are features of those, not concepts I'd pick on their own.

#### User, the PM



My ranking: C, D, B, F, E, H, A, G. The concepts I like most ask my engineer for only a few minutes, and only where it matters, and they work through the gates I already run. The ones I like least hold a slice until a senior's calendar frees up. Owner, I heard you on "no medium decisions adopted in my area while I'm on call": B, D and F give you that without making you open a dashboard.

##### A
reaction: The door-open finding is gorgeous: "none tries a home of exactly 10" is what makes my engineer trust a check. But every slice in their paths waits until they write the failing test, so wave 2 sits on @jdewitte's morning. That is exactly the gate I said would cost me too much.
remix: Yes, and use it only on slices the plan marks risk-high or stored-shape, where the engineer would demand it anyway. On the Omni page I see "s3 waits on @jdewitte's red since 09:40" while the other slices keep building, so I know who to nudge.
scores: wow 4, value 3, craft 5, fit 3
stance: Right idea about proof, wrong default. I back it only as an opt-in for risky slices.

##### B
reaction: This costs me nothing: it starts after merge, and the engineer doesn't fill anything in, because their rewrite is the claim. "The loop answers for its code" is the line a skeptic can repeat to a peer. My doubt is timing: it earns trust over months and won't get this week's PR merged.
remix: Yes, and put the per-area "lines still as the loop wrote them" number in the feature PR body next to risk, so the first merge carries the track record. Each claim's drafted rule also shows up in my next /omni:brainstorm in that area, so I stop writing specs that invite the same rewrite.
scores: wow 4, value 4, craft 4, fit 4
stance: Strong. It's the retro made personal and it doesn't touch my day. I'd pair it with something that pays off before the first merge.

##### C
reaction: This is the one. The loop builds 612 lines and asks my engineer for the 4 that decide, shown on real invoices, and git blame shows her name. It also runs on the gate I already have: the gap blocks ready like a high outbox item, and `p` hands it to me when it's a product call. Finding that our PDF and our Peppol export already disagree is a product bug I'd want to know about anyway.
remix: Yes, and when the owner presses `e`, I get one line on the PRD page ("Ines settled VAT rounding: per rate, like Peppol") so I'm never blindsided by a product decision taken in code. The "left alone: VatCalculator.php" note becomes a ready /omni:bug-fix line I can hand to its owner.
scores: wow 5, value 5, craft 4, fit 5
stance: My favourite. It gets engineers to merge because the lines that decide are theirs, and it asks them for minutes, not a gate.

##### D
reaction: This is the cheapest way I've seen to kill "style that isn't ours". The payoff lands on the very first agent PR, because it mines years of their own reviews. Engineers love being quoted correctly, and it never rewords them, which is our own principle. My day doesn't change, and the "Not useful" button keeps it honest.
remix: Yes, and bring it forward to brainstorm: the spec lists which owners' rules the PRD will touch ("R-API-14 applies, @ines-v"), so the engineer sees their words in the phase-0 PR before any code is written.
scores: wow 4, value 5, craft 4, fit 5
stance: Strong yes. It's the knowledge base taught in the flow of review, which is the gap the fuel sheet names.

##### E
reaction: "Read only the two unpaid lines" is exactly what gets a big review done by Friday, and surviving mutants make empty tests visible. But the card is dense: three gutter letters on every line is a lot of chrome for someone who already distrusts the tool. I couldn't read any of it on my phone. I don't need to, but I do need to know why a review is stuck.
remix: Yes, and roll it up into one line on the feature PR that I can read between meetings: "612 lines, 604 paid, 8 for @ines". I'd show receipts only on hover, so the diff looks like a normal diff until the engineer asks.
scores: wow 4, value 4, craft 3, fit 4
stance: Good against slop, heavy to look at. I'd keep the unpaid-line idea and drop most of the gutter.

##### F
reaction: This is the right control model: the engineer sets the level per area, and the agent has to earn a promotion with a record read from git. It's what would make my grumpiest engineer say "fine, try it". The risk is my week: if everyone claims their turf at "show me first" on day one, every PRD crawls. It does show me "s4 with @pderval since 14:02" and lets s1–s3 carry on.
remix: Yes, and show the turf cost at brainstorm, not mid-wave: "this PRD crosses 2 hands-off areas and 1 show-me-first area, about 2 days of @pderval". Then I plan around it or split the PRD before yolo starts.
scores: wow 4, value 4, craft 4, fit 4
stance: I'm for it, provided the cost shows up before I run yolo. Otherwise it's a veto over my week.

##### G
reaction: €12.60 against €12.59, checked against 41 archived PDFs, is the best demo moment of the eight. But it builds every owned slice twice to find what C finds by simply asking, and "per line or per total" is really a product decision that should come to me. It doesn't touch style or control at all.
remix: Yes, and double-read only the slices whose decisions the outbox would rank high or hardToRevert, and build the rest once. A disagreement that is a product call comes to me with the invoice attached.
scores: wow 5, value 3, craft 4, fit 3
stance: A brilliant trick, not the answer. I'd like it as a tool inside C or E, not as its own concept.

##### H
reaction: `omni take s4` is the escape hatch a grumpy engineer wants: they can grab the wheel mid-build and the loop carries on from their commits. The doing/why/next brief is what I'd want to read too. But "agent-4 requests control, ~40 min, nothing written until you answer" puts a live gate in front of my slices, and it assumes the engineer is watching a terminal while I'm in meetings.
remix: Yes, and let `take` also be how an engineer starts on my PRD on their own: they can take a slice before wave 1 because they want it, and I see "s4 with Sophie" on the page. Handing back should never be a wait. When there's no answer, the slice stays armed and the others move.
scores: wow 4, value 4, craft 4, fit 3
stance: I'm for taking control and against being asked for it. Keep `take` and `give`, drop the request gate.

### Turn 2: cross-talk (each panelist answers the others by name)

#### Visionary



**Skeptic**, you changed my mind on G. Two agents from one model share their mistakes (Knight and Leveson), so "38 concordant hunks, folded" is false comfort; I drop that half of my remix. G survives as the finder: a disagreement means nobody settled it, and the cross-tests expose hollow tests. **Craft**'s grey "agree, not verified" is the honest label. Scoped to critical paths (**Owner**), C+G stands; the Owner's blast radius ("changes 214 of last year's invoices, up to €0.03") is my screenshot upgrade.

**Owner**, you changed my mind on D: guarding colleagues' PRs is you overruling a peer through a bot. D stays in your paths. **Craft**'s flip makes D worth forwarding: quote only where a first draft broke your rule and was rebuilt.

**Skeptic**, your backfilled line ledger fixes my timing complaint about B. I keep the public post-mortem, plus the Owner's bug / taste / spec-moved key.

**Value**, D+E is the sensible core, but nobody forwards a green check. **Craft**, your promotion on the 23rd clean sub-PR beats my turf.yml PR. I switch.

- A: wow 4, value 3, craft 4, fit 4. Unchanged; a level for money paths.
- B: wow 5, value 5 (up 1: the backfill pays off on day one), craft 4, fit 5. The learning spine.
- C: wow 5, value 4, craft 5, fit 5. The crowned moment.
- D: wow 4, value 5, craft 4, fit 5. Only "rebuilt to hold your rule".
- E: wow 5 (up 1: the Owner would defend it to a peer), value 5, craft 5, fit 4. The evidence floor.
- F: wow 3, value 5, craft 4, fit 5. The dial, delivered in review.
- G: wow 5, value 3 (down 1: shared errors, theatre outside money code), craft 4, fit 4. The finder, never a verifier.
- H: wow 4, value 3 (down 1: the Owner would take control twice a quarter), craft 4, fit 4. The brief on every PR.

**My dissent**: Craft, Skeptic and Value crown F, with C as its "ask first" setting. I refuse. A dial is a settings page, and nobody defends a settings page to a peer. C is not one setting among four: "nothing guessed in your code; the lines that decide are yours" must hold at every level, build-tell included. Lead with C; F sets how much else the owner sees.

#### Craft



**Skeptic:** "held means a check ran" beats my own D remix. The owner's quote becomes the check's message and shows only when the check failed or forced a rebuild. Adopted. Your line ledger underpins B and F: without it, a squash merge makes their numbers wrong. "Run it on shipped PRDs first" is B's empty state, designed. And H's "~40 min" is a guessed value (P-PRODUCT-7). Conceded.

**PM:** you moved me on E. The default should look like a normal diff: only unpaid lines marked, receipts on demand. "Turf cost at brainstorm" is F's missing transition: the cost shows up in the phase-0 PR.

**Visionary:** promotion as a PR against `.omni-loop/turf.yml` beats my review-comment remix. With no CODEOWNERS file here, it is also F's empty state. B+D: one memory, then one rule card, with the same y/e/n keys whatever the source.

**Owner:** your blast radius under each of C's options (last year's invoices, in euros) is the remix of the round. Your pager hand-back is H's transition, done better.

**Value, Visionary:** D quoting on colleagues' PRs is what the Owner called overruling a peer through a bot. Hold it back.

##### Updated lines
- A: wow 4, value 3 (↓: the Owner's bottleneck point), craft 4, fit 4. An opt-in level in F.
- B: wow 5 (↑: the post-mortem on the old sub-PR), value 4, craft 4, fit 4. The record, and only on a ledger.
- C: wow 4, value 5, craft 5, fit 5. The surface to crown.
- D: wow 4, value 4, craft 4 (↑: the Skeptic's checks), fit 5. Quote on failure, never on compliance.
- E: wow 5, value 5, craft 4, fit 4. Plain diff; precedents only from stable code.
- F: wow 4, value 5, craft 4, fit 5. The dial, as turf.yml.
- G: wow 4, value 4 (↑: scoped to money paths inside C), craft 4, fit 3. An engine, not a concept.
- H: wow 4 (↓: owners won't watch live), value 4, craft 4, fit 4. The brief on every PR; no request gate.

##### Dissent
The C+G majority folds the 38 agreeing hunks away as settled. That fold is the lie: two builds from one model share the same unexamined guess. Show agreeing hunks in grey, marked "agree, not verified". When an oracle found the line (archived outputs, or code that disagrees with itself), name the oracle, not the second build.

#### Skeptic



**C+G.** Yes, but Visionary, the 38 agreeing hunks must not "fold away unread". Two builds from one model share blind spots: a decision both take alike never becomes the owner's line, so G narrows C's misses without closing them. Craft's grey "agree, not verified" is the honest label. PM: rounding can be a product call; `p` stays.

**B+D.** Yes, as one memory. The Owner's and Craft's key (bug, taste, or spec moved) answers my noise worry, so I move on B. Visionary's public post-mortem posts only after "bug". D's "held" must be a check that ran.

**F as the dial.** Yes, Craft, with one fix: mutation receipts run at every level, because evidence isn't a notch. I adopt Visionary's turf.yml promotion PR and the PM's turf cost shown at brainstorm.

**Value:** running D on human PRs is out of scope. It makes the loop a lint bot on colleagues and proves nothing about agent code.

**Lines**
- A: wow 4, value 3, craft 4, fit 4. Unchanged; opt-in level.
- B: wow 5, value 5 (+1, the key kills the noise), craft 4, fit 4. The trust spine; the proof is a line ledger that survives a squash merge.
- C: wow 5, value 4, craft 5, fit 4. The moment to crown, plus the Owner's blast radius.
- D: wow 4, value 4, craft 4, fit 5. Unchanged: checks, not verdicts, and quotes only on exceptions (Craft).
- E: wow 4, value 5 (+1: the Owner's stable-code-only precedents and Craft's side-by-side view make the precedent receipt checkable), craft 5, fit 4.
- F: wow 4, value 5, craft 4, fit 5. The dial; its record reads B's ledger.
- G: wow 5, value 3 (−1: theatre without a real record to test against, as the Owner and Craft say), craft 5, fit 4. An engine inside C.
- H: wow 4, value 3 (−1: the Owner says twice a quarter), craft 4, fit 4. The handover brief goes on every sub-PR.

**Dissent.** Most of the panel lets the owner read less: skip paid lines, fold agreeing hunks. I hold that nothing goes unread by default. "Read less" is an F level an area earns only once B's ledger shows that unread lines survive as well as read ones. Until then, receipts and agreement order the reading; they don't remove any.

#### Value



**Skeptic**, you changed my mind twice. B's ledger over already-shipped PRDs is day-one proof, so B goes up. And a "held" the loop awards itself is reassurance without proof, so D goes down until its rules are checks that run.

**Owner**, I withdraw my D remix. Your rules on colleagues' PRs would be you overruling a peer through a bot: keep them to your turf unless the other owner confirms. "Twice a quarter" lowers H; keep its brief on every sub-PR.

**Visionary, Skeptic, Owner, on C+G**: I accept G as C's detector in critical paths. A measured split, not the agent's hunch, answers my worry about who spots the undecided line. Owner's euro blast radius per option makes a four-minute answer safe.

**Visionary, on B+D**: yes to one memory from what owners say and rewrite; neither adds a chore. Craft's key for "the requirement changed" keeps the number honest.

**Craft, PM, on F as the dial**: agreed. The repository has no CODEOWNERS, so claiming turf comes first for C, D and F. It must be one cheap PR (Visionary's turf.yml), its cost shown at brainstorm (PM).

A: wow 3, value 3, craft 4, fit 4. Unchanged; F's "I write the red" level.
B: wow 4, value 5 (was 4, history-first ledger), craft 4, fit 4. The proof shown to a peer.
C: wow 4, value 5 (was 4, G finds the line), craft 4, fit 5. How the owner is asked.
D: wow 4, value 4 (was 5, "held" unproven), craft 3 (was 4, Craft's comment wall), fit 5. Exceptions only, checks behind the quotes.
E: wow 4, value 5, craft 5, fit 4. Unchanged; B's ledger audits receipts.
F: wow 3, value 5 (was 4, turf comes first), craft 4, fit 5. The dial, set by a PR.
G: wow 5, value 4 (was 3, as C's engine), craft 4, fit 4 (was 3, folded into C). Never standalone.
H: wow 4, value 3 (was 4, the owner isn't watching), craft 4, fit 4. The brief everywhere; `take` rarely.

**My dissent**: the majority is crowning the moment (C+G), which lands only on rare PRs, mostly money code. Merging agent PRs without rewriting them is won on every PR: E's reading bill falling, D's rules holding, B's ledger proving it. Crown the every-PR payoff; make C+G its best screen, not its spine.

#### User, the owner



**Skeptic**, you changed my mind twice. On G: two builds share the same mistakes, so a wrong line both agree on arrives folded as "concordant" and never becomes C's line. G finds decisions against a real oracle, never by agreement. On B: after a squash merge, git blame lies. I need your line ledger, and your backfill over shipped PRDs is what wins me on day one.

**Craft**, making deletions pay and showing precedents side by side make E defensible to a peer. On D you're right: quote me only where the diff would have broken my rule.

**Value, Visionary**: no to my rules policing human PRs. A bot quoting me at colleagues turns the control objection on my peers.

**Visionary**, turf.yml as a PR is the remix of the round: trust as code, reviewed where I already review, and owners without a CODEOWNERS file. But "this PR costs you 7 lines" gets gamed: the loop rebuilds to get paid, not to be right.

**PM**, fair: show my turf's cost at brainstorm. On H, agreed: taking control, yes; being asked, no.

Updated:
- A: wow 4, value 3, craft 4, fit 3 (unchanged). An F level for money paths.
- B: wow 5, value 5 (up from 4: the backfill pays on day one, and Craft's `r` key fixes attribution), craft 4, fit 4. The record under everything.
- C: wow 4, value 5, craft 5, fit 4 (down from 5: no CODEOWNERS file, and no way yet to find the decision). How I want to be asked.
- D: wow 4, value 4 (down from 5), craft 3 (down from 4): "held" must mean a check ran.
- E: wow 5, value 5, craft 4, fit 4 (unchanged). My quality pick.
- F: wow 4, value 5, craft 4, fit 5 (up from 4: turf.yml lives in git). The dial.
- G: wow 5, value 3, craft 4, fit 3 (scores unchanged, stance moved). Finds decisions, never verifies.
- H: wow 4, value 3, craft 4, fit 3 (unchanged). The brief on every sub-PR.

**My dissent:** Craft, the Skeptic and Value make E the "show me first" notch. No: receipts are the floor under every level. "Build, tell" without receipts is today's loop, the code I rewrite.

#### User, the PM



**Visionary, Skeptic and Owner, on C+G:** I dissent. Skeptic, your own Knight & Leveson point undoes your remix: two builds from one model agree on the decision neither noticed, so G misses exactly the lines C fears missing, at double my yolo. Craft's cap guards better: over two holes in one owner's paths, phase-0 asks them first.

**Craft, Skeptic and Value, on F as the dial:** I'm in, if the dial is Visionary's `turf.yml`, changed by PR, so I see claims land, not meet them mid-wave (no CODEOWNERS exists). And the Owner's pager remix applies at every level: nothing sits frozen on a person.

**Owner and Craft, on B:** the bug / taste / spec-moved key is right, and a "spec moved" claim comes to me. Skeptic, running B over shipped PRDs answers my timing doubt.

**Value and Visionary, on D guarding human PRs:** no. The Owner called that overruling a colleague through a bot.

**Owner, on E:** you'd stop rewriting, so I've changed my mind. Craft's check annotations fix the density I marked down.

- A: wow 4, value 3, craft 5, fit 4 (up from 3). An opt-in F level with Craft's `g` key no longer stalls my wave.
- B: wow 4, value 5 (up from 4), craft 4, fit 4. Computed on history, it pays off on the first PR.
- C: wow 5, value 5, craft 4, fit 5. Still my top pick, plus Craft's cap and the Owner's blast radius.
- D: wow 4, value 5, craft 3 (down from 4), fit 5. Quote only the exceptions, and "held" must mean a check ran.
- E: wow 4, value 5 (up from 4), craft 4 (up from 3), fit 4. The Owner's quality pick.
- F: wow 4, value 4, craft 4, fit 5 (up from 4). The dial, with its cost shown at brainstorm.
- G: wow 5, value 3, craft 4, fit 3. Unchanged. A tool for money slices.
- H: wow 4, value 3 (down from 4), craft 4, fit 3. Twice a quarter, says the Owner. Keep the brief; drop the guessed "~40 min".

**My dissent:** G is not C's engine. C finds its lines by asking: outbox rank, gaps in the knowledge base, code that disagrees with itself. A second blind build runs only where an owner switches it on for money code.

Cross-talk stopped after one turn: every panelist had moved and restated a dissent; a second turn would repeat them.

### The person's answer to round 1

> The issue I would have is all of those a velocity killer and ai velocity killer - as soon as ai needs a human for opinion of an old developers - we kills the velocity - in this options I see lots of developper opinion - not so much a the ai did wrong except maybe the 2 agents

Then, asked how round 2 should go under the rule "nothing waits on a human's opinion during the build": **go wide again**.

## Round 2 (wide again, under the new rule)

### Turn 0: the panel restates under the new rule

#### Visionary



**Reward:** the forwarded confession: "what I got wrong, fixed before you saw it". Proven against real oracles (archived invoices, production, repository history), by adversaries from different models, with mistakes owned after merge unasked.

**Punish:** anything waiting on an opinion, self-awarded badges, same-model agreement as proof.

**Drop:**
- **C as the crown, and my dissent.** The owner writing the deciding line is a human stop. Its oracle ("your code disagrees with itself") survives, settled by the loop.
- **A, H's handovers, F's promotion asks, the "y" in B and D.**

**Keep:** B, with the loop claiming, fixing and reporting alone. G, if its second reader is a real oracle or another model.

#### Craft



**Now I reward** a self-correction trail the engineer audits after the fact, same shape on every PR: what the AI got wrong, what caught it (a mutant, an oracle diff, history), the fix, the proof. "Nothing caught" must say what was checked. What it cannot fix goes to today's outbox; the build keeps moving.

**I punish** any key press during the build, "fixed 12 issues" with no diff, one model grading its own work, numbers no ledger backs.

**I drop** C as the crown and my one-keystroke owner answers. A's red, F's dial and H's take/give go too: each waits on a person. E stays, but the AI pays its unpaid lines itself. My concordance dissent is now the rule.

#### Skeptic



**Moves.** I reward self-correction checked outside the model: mutants on the diff, replayed archived outputs and production behaviour, differential runs against the replaced code, and a ledger where the loop files and fixes its own claims after merge. I punish any human wait, an LLM grading its own diff, agreement passed off as verification, and cost with no measured catch rate.

**Dropped.** Owner-raised levels (F), owner red (A), deciding lines (C), handovers (H) and B's y/e/n key: each waits on a person. B survives if the loop classifies its claims from evidence.

**What must be true.** Independence comes from the oracle, not a same-model second agent. Prove the catch rate by replaying this repository's shipped bugs.

#### Value



The new rule sharpens my round-1 dissent: pay off on every PR, with no human minute during the build.

Reward: the loop catching and fixing its own slop before anyone looks (surviving mutants killed, rule breaches rebuilt); oracles that are not the model itself (archived outputs, repository history, a line ledger); a caught-and-fixed record shown at existing gates.

Punish: any human step on the critical path; self-awarded "held" or "paid"; same-model agreement sold as proof; any new place to visit.

Drop, because each waits on a human: C as "how the owner is asked", A and H entirely, F's owner-raised levels, the owner's y/n on B's claims and D's rules. B's ledger and E's receipts stay, self-enforced.

#### User, the owner



Fine: don't ask me. Then show me what you caught in yourself before I looked. On every sub-PR, a self-correction log I can replay with one command: the mutant that survived and the test it added to kill it, where its output disagreed with archived invoices or production and what it changed, the slice it threw away and rebuilt. After merge, a line ledger in my paths; when a page traces to its lines, it opens the fix itself. I walk away if "it checked itself" means the same model grading its own homework in prose, if a number can't be recomputed, or if never asking me turns into silent decisions in my code that the outbox doesn't name.

#### User, the PM



This rule is my round-1 fear written as law: nobody waits on anyone, me included. I now reward a loop that catches its own slop before a sub-PR opens, kills its own mutants, and checks itself against real oracles (archived invoices, production, our history). After merge, a line ledger reopens its own misses and fixes them, and the engineer audits it later, never asked. I punish any new wait, any number that isn't computed, and anything that lengthens my outbox. I drop C as my top pick, because a deciding line is a wait on someone's opinion. I also drop F's levels, the phase-0 cap, A, take/give, and B's keys. One dissent stays: a same-model second build is no check.

### Turn 1: open (each panelist on G, I–N)

#### Visionary



Six of seven check the loop against something no model chose: a gauntlet before merge (I, L, N, G), ownership after (J, K, M).

##### G
reaction: The oracle now decides, and I, L, M reach it without a second build. Only the cross-test trick ("A's tests pass on B, so none pins the rounding") is left unique.
remix: Yes, and build B with another model family, with the archive as the only judge.
scores: wow 3, value 3, craft 4, fit 3, feas 3
stance: Absorbed. The cross-test trick goes to L.

##### I
reaction: "It caught itself re-making Inès's 2022 reverse-charge bug, citing her commit." The team's history is the exam, and the model chose none of the bugs. Planting old bugs back in exposes hollow tests. The kept failed run is honesty a skeptic forwards.
remix: Yes, and run it on day one over every line the loop already shipped: "27 of your team's past bugs replayed on 14,212 loop lines: 1 re-made, fixed", a record before any new PRD.
scores: wow 5, value 5, craft 4, fit 5, feas 3
stance: Champion. Risk: re-aiming old tests at renamed functions.

##### J
reaction: "+€2,361.84 VAT, caught while the old code still served every customer" is the round's best screenshot. "An undeclared difference is the candidate's bug, removed, not argued" is the confession tone I want. But it needs old code to shadow.
remix: Yes, and replay a week of recorded real calls against the feature branch before merge, so the table lands in the feature PR.
scores: wow 5, value 4, craft 5, fit 4, feas 3
stance: Keep, for rewrites of pure computations.

##### K
reaction: My round-1 B remix without the human "y". The loop traces its own escape, says why its checks missed it, recalls five siblings each proven red, and guards the slices in flight. "Escapes of a guarded mistake: 0" is the Waymo number a skeptic quotes to a peer.
remix: Yes, and post the recall notice on each original sub-PR it corrects, with the escape record at the top of every feature PR in those paths.
scores: wow 5, value 5, craft 5, fit 5, feas 4
stance: Crown candidate: the only concept that improves each time the loop fails.

##### L
reaction: "Its own 14 tests passed on both broken builds: only the relations caught them" shows hollow tests in one line. Dropping a rule that "fails on main too" is honest. Property testing is known; the wow is 100.02 on a 100.01 quote.
remix: Yes, and let every escape (K) and past bug (I) add a relation, until the repository holds executable law written from the loop's own mistakes.
scores: wow 4, value 5, craft 5, fit 5, feas 4
stance: The gauntlet's engine; the most feasible proof that tests bite.

##### M
reaction: Five places stating one fact, "✗ 41" in the export column, and "at #1316's parent all 41 balance" proving whose break it was. Double-entry for code, made for Vertuoza's documents.
remix: Yes, and treat L's R6 as M's pre-merge form: generated documents before the sub-PR, real ones nightly, one table.
scores: wow 5, value 5, craft 5, fit 5, feas 3
stance: The strongest real oracle here. Merge with L; feed breaks to K.

##### N
reaction: A burnt invoice number and a double send are the bugs that page seniors, and "breaks 8 of 9 past failure-handling fixes" is calibration done right. But chaos in CI is familiar, and the rig per slice is heavy.
remix: Yes, and make every check publish its catch rate on this repository's past fixes; one that catches none is retired, Tricorder-style.
scores: wow 4, value 4, craft 4, fit 4, feas 2
stance: Calibration for everything; the drill only where queues and transactions are touched.

---
My ranking: K > I > M > L > J > N > G.

The crown I'll push is **"Never twice"**. Before merge, a gauntlet: past bugs (I), relations (L) and the balance (M). After merge, K turns each escape into a new guard there. Same mistake never twice, proven without asking anyone.

#### Craft



##### G
reaction: The card still ends on "A is right / B is right", the interaction the rule now forbids. The €12.60/€12.59 panel is still the best single element. Without an arbiter, the second build is just a disagreement finder, which L does without building twice.
remix: Yes, and the oracle settles each split ("settled by 41 archived PDFs"); with no oracle, it becomes a high outbox item.
scores: wow 4, value 3, craft 3, fit 3, feas 3
stance: Keep the panel and fold the idea into L.

##### I
reaction: The most honest card of the round. Run 1's failure stays in the commits, "2 not replayable" admits the gap, and every row cites the team's own fix. The hidden weak step: the model ports each old test, and a port can soften the assertion.
remix: Yes, and each re-aimed test opens side by side with the original. A slice with no history says "0 replayed", not "passed".
scores: wow 5, value 5, craft 5, fit 5, feas 3
stance: A core pick: the round's best "caught itself" story.

##### J
reaction: The day table is precise: one red reset row and the promotion contract stated up top. Two states are missing: the end (when are control and the wrapper deleted?) and the silent production switch in code the owner is paged for.
remix: Yes, and at promotion the loop opens the PR that deletes control and the wrapper, so the switch lands at today's merge gate.
scores: wow 5, value 4, craft 4, fit 3, feas 2
stance: Spectacular, but production infrastructure for pure computations only. A later tier.

##### K
reaction: A real post-mortem: escape, why its checks missed it, sweep, guard. It leaves a person's look-alike alone, and every record number links to a PR.
remix: Yes, and G-9 must run red on the escaped commit (#1436) before it is trusted. The record line ("escapes 2 · guarded 0 since") appears on every sub-PR in that area.
scores: wow 4, value 5, craft 5, fit 5, feas 4
stance: A core pick. The loop owns its escapes through today's bug-fix gate.

##### L
reaction: The round's most deliberate pixel is the struck-through relation, dropped because it fails on main too. That is restraint, shown. "Its own 14 tests passed on both broken builds" proves the search bites where tests did not. The 875,000 headline is a budget, not evidence; demote it.
remix: Yes, and a counterexample the slice cannot fix within its territory goes to the outbox with the shrunk input attached.
scores: wow 4, value 5, craft 5, fit 5, feas 4
stance: My top pick: the smallest build and the strongest oracle, with nothing asked.

##### M
reaction: The fact-by-place matrix with one red cell is the best at-a-glance surface in the set. "#1316's parent balances" makes attribution evidence; BREAK / FIXED / KNOWN are honest states. The weak spot is input: PDF parsing is brittle, and reading a production replica is a governance project.
remix: Yes, and each pair that balances on main becomes a relation for L, fed with generated documents, so the 6% credit note is caught at sub-PR time, not in production.
scores: wow 5, value 5, craft 5, fit 4, feas 3
stance: A core pick with L. The product's own statements are an oracle with no blind spots shared with the model.

##### N
reaction: "Calibrated on 9 past fixes: breaks 8" proves the drill bites, and each invariant names its confirmed law. But the card hides the ninth, and the miss is what the engineer needs most. At 11m40s, only for slices that write or send.
remix: Yes, and name the miss, and draw each slice's fault list from I's history of this repository's own failure fixes.
scores: wow 4, value 4, craft 4, fit 4, feas 3
stance: A strong tier for side-effecting slices. Not the spine.

##### Across the set
- Six cards, one shape (run 1 red, smallest input, fix, pinned test, run 2 green): make it one `omni / self-check` check run.
- "Nobody was asked" is on four cards: a fact field, not a slogan.

#### Skeptic



##### G
reaction: Under the new rule, an oracle has to settle every disagreement, and then the oracle does the work. It is twice the build, from one model with one set of blind spots.
must be true: the two builds come from different models, not different seeds. Proof: on 20 past slices, count the bugs only the second build catches.
remix: Yes, and keep the cross-test, as a test critic inside L.
scores: wow 4, value 3, craft 4, fit 3, feas 2
stance: Superseded by the outside oracles.

##### I
reaction: The team's past bugs, chosen by history and not by the model. The weak point: the model re-aims each test and plants each bug, so it can quietly weaken its own oracle.
must be true: each re-aimed test fails on the code just before the old fix and passes on the fix itself. Proof: replay this repository's `.omni-loop/delivery/bugs`.
remix: Yes, and the same replay scores every other check (L, M, N).
scores: wow 5, value 5, craft 4, fit 5, feas 3
stance: Top three: the benchmark.

##### J
reaction: Production is the strongest oracle there is. But J needs old code that computes the same thing, so it covers rewrites, not new features, and it has the loop promoting itself live.
must be true: a pure computation, a declared difference the code can check, and ops accepting the extra computation. Proof: shadow one day of real inputs offline.
remix: Yes, and run it dark offline, on M's corpus, by default.
scores: wow 5, value 4, craft 4, fit 3, feas 2
stance: Brilliant for rewrites, too narrow for the spine.

##### K
reaction: The escape is reproduced red on main, each sibling in the sweep is proven red, and each thing a check missed becomes a guard. That is the loop answering for its code.
must be true: git notes aren't pushed by default, so the loop must rewrite them onto the squash commit and follow lines through later edits. Proof: build the ledger over omni-loop's shipped PRDs.
remix: Yes, and each guard joins L's rules and I's corpus.
scores: wow 5, value 4, craft 5, fit 5, feas 3
stance: The ledger every other concept needs. Build it first.

##### L
reaction: The most feasible outside oracle. Its rules come from the approved spec and the confirmed laws, an implied rule is kept only if main already obeys it, and each shrunk counterexample becomes a test. The catch is that the model writes the properties.
must be true: the domain has generators, mutation grades the properties, and CI can afford minutes. Proof: run R1–R7 on the commits just before past rounding fixes.
remix: Yes, and publish each rule's catch rate on I's replay.
scores: wow 4, value 5, craft 5, fit 5, feas 4
stance: My first build.

##### M
reaction: The same fact as the product's other outputs state it, mostly in code people wrote: an oracle the model didn't choose. Pairs that don't balance on main are dropped, and bisecting the break to the parent commit proves whose it is.
must be true: anonymised replica access that data governance accepts, with the PDF checked on what the renderer is fed. Proof: database against UBL over one month of documents, offline.
remix: Yes, and every break, K's escapes included, grows the corpus.
scores: wow 5, value 5, craft 5, fit 4, feas 3
stance: Top three: it sees what slice tests never see.

##### N
reaction: Real failures (a burnt number, a double send), checked against confirmed laws. But it only covers slices with I/O seams, every service needs a harness, and race drills flake.
must be true: injectable clocks, stubbable services, and drills deterministic enough to pass Tricorder's noise bar. Proof: one drill in CI, killing the worker between numbering and commit.
remix: Yes, and run it only when a slice touches transactions or outbound sends.
scores: wow 4, value 4, craft 4, fit 4, feas 2
stance: A specialist, not the spine.

**My cut:** K's ledger first, then L scored against I's replay, then M nightly. J and N are specialist modes. G retires.

#### Value



Every card now spends machine minutes, not a person's. So: which oracle sits outside the model, and does it pay on every PR?

##### G
reaction: Without the owner arbitrating, the archived PDFs do all the work, and the second agent adds cost without independence.
remix: Yes, and drop the second agent; keep G's real insight (a test passing on a known-different build pins nothing) by running the slice's tests against I's planted bugs.
scores: wow 4, value 2, craft 4, fit 3, feas 3
stance: Superseded; its cross-test lives on in I.

##### I
reaction: The oracle is the team's own bugs, which the model never chose, and it pays on nearly every slice in an old repository. "Its failed first run is still in the history" is the confession the person asked for, and the plants prove the tests bite without any mutation config.
remix: Yes, and run it first over agent slices already merged, so the owner's first screen is a measured catch rate on real history. A new fix on main that the replay would have missed counts against the loop.
scores: wow 5, value 5, craft 5, fit 5, feas 3
stance: My top pick before merge, provided old tests are re-aimed at new functions faithfully.

##### J
reaction: Production is the strongest oracle on the board, and "control served every customer until then" beats any review. But it covers only rewrites of pure computations, needs a shadow harness and production capture, and auto-promotion quietly moves release control.
remix: Yes, and feed its captured inputs into L and I as seeds, so one dark run hardens every later slice in that area.
scores: wow 5, value 4, craft 4, fit 3, feas 2
stance: A per-domain oracle for rewrites, not the spine.

##### K
reaction: B's ledger, enforced by the loop itself: it traces, sweeps only its own lines, proves each red, fixes, and leaves a person's look-alikes alone. "Escapes of a guarded mistake: 0" is the number a skeptic quotes to a peer. It starts from an escape; its guard pays on every PR after.
remix: Yes, and each recall's guard becomes a property in L and a plant in I, hardening every later pre-merge run.
scores: wow 4, value 5, craft 4, fit 5, feas 3
stance: My top pick after merge, if the ledger truly survives the squash.

##### L
reaction: The most buildable card: fast-check, seeded and shrinking, in CI, keeping a derived relation only if it holds on main. "Its own 14 tests passed on both broken builds" proves the objection about tests that prove nothing in one line. Its reach is computational code.
remix: Yes, and seed the generator with I's historical bug inputs and J's real documents, so the search starts where the team already bled.
scores: wow 4, value 4, craft 5, fit 5, feas 4
stance: The cheap default on every computational slice.

##### M
reaction: The product's other statements of the same fact make a clever oracle, and L's R6 is already one of its pairings. But it needs a reader per output format and a production replica, and it is shaped around invoicing.
remix: Yes, and merge it into L: the same relations over two corpora, generated inputs before merge and real documents nightly.
scores: wow 4, value 4, craft 4, fit 4, feas 2
stance: Folds into L as its real-data half.

##### N
reaction: It aims at pager bugs (a burnt number, an invoice sent twice), and "breaks 8 of 9 past fixes" is a measured catch rate. But the harness is heavy for each repository, and the drill adds about 12 CI minutes per slice.
remix: Yes, and make calibration the gate: a repository gets the drill only once it catches past fixes above a bar.
scores: wow 4, value 4, craft 4, fit 4, feas 2
stance: Strong on side-effect slices; opt-in by calibration.

##### Across the set
My crown: I before merge, K after, both graded by the repository's own history; L the cheap default; J, M and N oracles a repository earns by calibration, each publishing its miss rate.

#### User, the owner



##### G
reaction: Once the oracle picks, the second build is dead weight: the 41 archived PDFs did the work, and one model's two builds round the same wrong way. Only the cross-test is unique.
remix: Yes, and keep only that: a second build from a different model, whose only job is to break the first build's tests.
scores: wow 3, value 2, craft 4, fit 3, feas 3
stance: Superseded by I, L and M.

##### I
reaction: Our 27 bugs, none chosen by the model, replayed on its code, with the failed first run kept: that gets me. Planting old bugs back is mutation testing with mutants we actually shipped. My worry is the re-aim: a badly rewritten old test passes for the wrong reason.
remix: Yes, and show each plant and each re-aimed test beside the original fix diff, and count the replays it couldn't translate faithfully.
scores: wow 5, value 5, craft 5, fit 5, feas 3
stance: My top pre-merge pick. Feasibility hangs on how messy our commit-to-bug links are.

##### J
reaction: A dark run is how I'd de-risk a totals rewrite myself, and "control served every customer until then" is what I want at 3am. But it needs an old version and pure code; a new feature has no control. And promoting itself in production with nobody told is a change on my pager with no name on it.
remix: Yes, and post every promotion and fallback to on-call with the rollback command, as a notice, not a question.
scores: wow 5, value 4, craft 5, fit 3, feas 3
stance: Great for rewrites of pure computations, and narrow.

##### K
reaction: "Owns its mistakes after merge", done right: a ledger that survives the squash, red on main, why its checks missed, a sweep of its 14,212 lines, and a new guard on slices still being built. It lists VatCalculator.php and leaves it alone. "0 escapes of a guarded mistake" is the number I'd quote to a peer.
remix: Yes, and treat my quiet rewrite of its lines on main as an escape too. That's On the Hook with no human step, because I've already done the rewrite.
scores: wow 5, value 5, craft 5, fit 5, feas 4
stance: The spine. Everything else feeds its guards.

##### L
reaction: "Its own 14 tests passed on both broken builds" is the most honest sentence on the board. A derived rule survives only if it holds on main, so main judges, not the model. It's fast-check with a replayable seed; buildable this quarter.
remix: Yes, and commit the generators as shared builders in the repository, so my own tests use them too.
scores: wow 4, value 5, craft 5, fit 5, feas 5
stance: The most buildable one. The default for computational code.

##### M
reaction: Our own outputs as the oracle is right for invoicing, and "at #1316's parent the export balances all 41" is proof of blame, not opinion. But the PDF and portal extractors, and an agent on a production replica, are real cost.
remix: Yes, and report its own miss rate: every nightly break the pre-merge balance should have caught shows up as a trend.
scores: wow 5, value 5, craft 4, fit 4, feas 3
stance: The best oracle for invoicing. Start with UBL against the export.

##### N
reaction: A burnt invoice number and a double Peppol send are the bugs that page me, and no input search finds those. Calibrating on our 9 past fixes (8 caught) is how a check earns belief. But the per-slice harness is a lot of CI to build and keep green.
remix: Yes, and seed the fault list from our postmortems, and retire any fault that hasn't broken anything in 90 days.
scores: wow 4, value 5, craft 5, fit 4, feas 3
stance: Run it by risk label, not on every slice.

**Where I stand:** K is the spine, I and L run before money sub-PRs, and M runs nightly. Stack all four on every sub-PR and each slice waits 25 minutes in CI. That's the velocity killer the person named, moved into CI. Pick the checks by risk label.

#### User, the PM



The new six ask nobody anything and add nothing to my outbox. I judge the oracle, the wall time and what my engineer can audit afterwards. I, K, M and N share one line ledger: build it first. My ranking: L, K, I, N, M, J, G.

##### G
reaction: The person liked seeing the AI wrong, but under the rule an oracle settles every disagreement, so the archived PDFs do the work and the second build is doubled cost.
remix: Yes, and the second reader is a different model; the cross-tests stay as a test-strength signal.
scores: wow 4, value 2, craft 4, fit 3, feas 3
stance: My dissent holds. Fold the cross-tests into L.

##### I
reaction: "It re-made Inès's 2022 bug, caught it, kept its failed run": bugs the model never chose, from our own git log, nobody asked. My worry: re-aiming an old test can quietly soften it.
remix: Yes, and the PR body says "27 of 27 past bugs caught; run 1 missed 3, fixed", and each re-aimed test shows its diff from the original.
scores: wow 5, value 4, craft 4, fit 5, feas 3
stance: Strong. Our own history is the oracle a grumpy engineer believes.

##### J
reaction: My engineer merges easily when customers can't be hurt, and 23 invoices at 21% instead of 6% is a chilling catch. But my feature sits dark until traffic proves it, only where old code exists, and wrapping production is a platform job.
remix: Yes, and the dossier shows "serving: control, 1,208 of 3,000 clean", the threshold scaled to traffic.
scores: wow 4, value 3, craft 4, fit 3, feas 2
stance: Good for rewriting money engines. Too narrow to be the spine.

##### K
reaction: It owns its mistakes after merge: the escape reproduced red, why its checks missed it, a sweep of its other lines (five fixes), and a guard that already caught a slice in the build. A person's look-alikes are left alone. It costs me nothing, and "escapes of a guarded mistake: 0" is what a skeptic repeats to a peer.
remix: Yes, and the recall lands on my PRD's dossier, and the ledger's record goes on every feature PR.
scores: wow 5, value 5, craft 5, fit 5, feas 3
stance: The trust spine. The ledger that survives a squash comes first.

##### L
reaction: "Its own 14 tests passed on both broken builds; only the relations caught them" is the slop case in one line, and my AC-3 caught 100.02. It takes 6 minutes in CI, replays from a seed, uses mature tools, and drops relations that don't hold on main.
remix: Yes, and /omni:brainstorm shows me which acceptance criteria became relations, so my specs get checkable. The PR body gets one line: "875,000 cases, 2 broke build 1, 0 at head".
scores: wow 4, value 5, craft 5, fit 5, feas 4
stance: My top pick. It's cheap, it runs before the PR, and my own spec does the catching.

##### M
reaction: The product's own five statements of one fact make an oracle no model chose, and the proof at #1316's parent is airtight. It also finds people's bugs, which I want. But five surfaces plus a production replica make it the heaviest build.
remix: Yes, and start with the database against the UBL on the replay corpus before the PR, with the nightly production run later. A person's break becomes a ready /omni:bug-fix line.
scores: wow 5, value 4, craft 4, fit 4, feas 2
stance: A great second act. Too heavy to lead.

##### N
reaction: A numbering gap and an invoice sent twice are the bugs that page my engineer, and "breaks 8 of 9 past fixes" is computed. It takes 12 minutes in CI, but every repository needs the harness.
remix: Yes, and run it only on slices whose territory touches a transaction, a queue or an outside service, with the calibration number printed on the check.
scores: wow 4, value 4, craft 4, fit 4, feas 3
stance: Strong for whoever carries the pager. Make it a check inside the winner.

### Turn 2: cross-talk

#### Visionary



**Owner**, you changed my mind. "Never twice" stacked I+L+M on every slice, which is the velocity killer moved into CI. Evidence picks the checks, not a person:
- **Territory.** Money functions get L, files with fix history get I, sends and transactions get N.
- **Calibration** (**Value**). A check runs in an area only if it catches that area's past fixes.
- **Parallel runs.** Wall time is the slowest check, not the sum.
- **Escapes.** K re-arms a check wherever an escape shows it was needed.

M leaves my default (**PM**, **Skeptic**: too heavy) and becomes an earned oracle.

**Owner**, your rewrite-as-escape is On the Hook with no human step. **Craft**'s requirement-change worry, computed: a rewrite counts only if it brings a test that fails on the loop's lines.

**Skeptic**: ledger first as build order, yes; it is not a story. **Value**, your I+K is my crown minus M. I take it.

**G**: retire it. Value's plants in I do the cross-test's job.

- G: wow 3, value 2 (down 1: superseded), craft 4, fit 3, feas 3. Retire.
- I: wow 5, value 5, craft 5 (up 1: Craft's side-by-side re-aim), fit 5, feas 3. The default where history exists.
- J: wow 5, value 4, craft 4 (down 1: no end state), fit 3 (down 1: promotes itself on the Owner's pager), feas 2 (down 1). Earned, for rewrites.
- K: wow 5, value 5, craft 5, fit 5, feas 3 (down 1: git notes don't travel by default). Spine and headline.
- L: wow 4, value 5, craft 5, fit 5, feas 5 (up 1: the Owner says buildable this quarter). First build.
- M: wow 5, value 4, craft 5, fit 4, feas 2 (value, fit, feas down 1: invoicing-shaped, replica governance). Earned oracle.
- N: wow 4, value 4, craft 4, fit 4, feas 2. Earned by calibration.

**Dissent:** build L first, crown K. **PM**, **Craft**: "875,000 cases" is a budget. A skeptic forwards the recall PR: "it found its own escape, fixed five siblings, guarded the slices in flight".

#### Craft



**Owner, on the 25 minutes:** you're right. A fixed rule, not the model, picks the checks from what the plan knows: territory, risk label, fix history in those files, transactions or sends touched. The checks run in parallel, so wall time is the slowest check, not the sum. `omni / self-check` prints what ran and what was skipped, with the reason ("N skipped: no transaction, queue or send"). A reasoned skip is the empty state, designed.

**Skeptic:** "each re-aimed test fails just before the old fix" answers my softened-port worry better than my side-by-side did. The machine proves it. Adopted.

**Visionary:** I change my crown. "Never twice" is the story; L alone was a build order. Per the Skeptic, the ledger comes first: ledger and L, then I, then K once the ledger survives squashes, then M nightly.

**Value:** G's cross-test is best in your form, the slice's tests run against I's planted bugs: a known-different build, judged by history, with no second agent. G retires.

##### Updated lines
- G: wow 3 (↓: nothing unique survives), value 2, craft 3, fit 3, feas 3. Retire it.
- I: wow 5, value 5, craft 5, fit 5, feas 3. Core; the port is now provable.
- J: wow 5, value 4, craft 4, fit 3, feas 2. Rewrites only, run offline.
- K: wow 5 (↑: the "never twice" engine), value 5, craft 5, fit 5, feas 3 (↓: git notes aren't pushed by default). Core, after merge.
- L: wow 4, value 5, craft 5, fit 5, feas 4. Ships first.
- M: wow 5, value 5, craft 5, fit 4, feas 2 (↓: five readers plus a replica). Start with database against UBL.
- N: wow 4, value 4, craft 4, fit 4, feas 2 (↓: flaky race drills). Only for slices that write or send.

##### Dissent
Four of you would quote "escapes of a guarded mistake: 0". On a young ledger that zero is a claim, not evidence. Print it with its denominator and age ("0 in 14,212 lines, since 3 Mar"), or leave it out.

#### Skeptic



**(1) Owner, agreed: stacked, it's 25 minutes.** Choose checks from computed facts, not people. Territory decides where each runs: L on pure code with generators, N on transactions and sends, I on files with fix history. The planner's risk label counts too. So does calibration: a check runs in an area only once I's replay shows it catches something there (Value). Run in parallel: the wait is the slowest check. M runs nightly, never per slice.

**(2) PM, Craft:** "ledger first" is the build order, not the crown. The ledger and L both start now. Visionary, "Never twice" is the story, but M's pre-merge half *is* L's R6 (Craft, Value). I change my mind: M folds into L. Value's I+K is the proof underneath.

**Owner, on K:** a rewrite counts as an escape only if it brings a test that fails on the loop's version. Otherwise it's a refactor. Craft: yes, a guard must fail on the escaped commit first.

**(3) G:** retire it. Value is right: I's plants carry the cross-test's insight.

**Lines**
- G: wow 3, value 2, craft 4, fit 3, feas 2. Value −1: I covers it. Retired.
- I: wow 5, value 5, craft 5, fit 5, feas 3. Craft +1: side-by-side ports. The benchmark.
- J: wow 5, value 4, craft 4, fit 3, feas 2. A later tier.
- K: wow 5, value 5, craft 5, fit 5, feas 3. Value +1: guards pay on every later PR. The spine.
- L: wow 4, value 5, craft 5, fit 5, feas 4. The first check.
- M: wow 5, value 4, craft 5, fit 4, feas 3. Value −1: its pre-merge half is L. Nightly.
- N: wow 4, value 4, craft 4, fit 4, feas 2. Runs where territory and calibration say.

**Dissent.** "0 escapes of a guarded mistake" and "27 of 27 caught" are true by construction: they count only mistakes already seen. The headline must be the miss rate: escapes, per area, that the gauntlet should have caught, as a trend. A skeptic believes misses, not catches.

#### Value



**Owner, on velocity**: right, and it's the person's own complaint. Checks run in parallel, so wall time is the slowest check, not the sum. Territory decides eligibility (PM, Skeptic: N only on transactions or outbound sends; L on computation; I where history exists, saying "0 replayed" when none does, per Craft). Measured yield decides sub-PR or nightly; see my dissent.

**Visionary**: I change my mind and take "Never twice" over my I+K. It is the same spine plus L, and it names the promise. M runs nightly, not before merge (Owner, PM).

**Skeptic**: the ledger is built first, yes, but build order is not the crown. Your port rule (a re-aimed test fails before the old fix and passes on it) closes the softening risk that Craft, Owner and PM raised in I.

**PM, Craft**: L ships first; it is the cheapest check.

**G**: retire. Its cross-test lives on as a test critic in L and I (Skeptic). A second build from another model must first pass the Skeptic's 20-slice proof.

G: wow 4, value 2, craft 4, fit 3, feas 3. Retired.
I: wow 5, value 5, craft 5, fit 5, feas 3. The port rule makes its oracle impossible to fake.
J: wow 5, value 4, craft 4, fit 4 (was 3), feas 3 (was 2). Offline replay (Visionary, Skeptic) removes the live self-promotion. Rewrites only.
K: wow 4, value 5, craft 4, fit 5, feas 3. Also counts the Owner's quiet rewrites as escapes.
L: wow 4, value 4, craft 5, fit 5, feas 4. Ships first.
M: wow 4, value 4, craft 4, fit 4, feas 2. Nightly; database against UBL first.
N: wow 4, value 4, craft 4, fit 4, feas 2. Transaction and outbound slices only.

**Dissent**: a risk label is the loop's own judgment and must not pick the checks. Each check earns its CI minutes by its catches per minute on I's replay of this repository's history, and drops to nightly below the bar. Every sub-PR prints wall time next to catches: velocity was the complaint.

#### User, the owner



**How checks get chosen without me:** territory and history pick. L runs where there's a computation with rules to keep. I runs where the files have past fixes, and says "0 replayed" otherwise (Craft). N runs only on transactions, queues or outbound sends (PM, Skeptic). M runs nightly, never per sub-PR. **Skeptic** and **Value** close the loop: every check is scored on I's replay of our history, and one that catches nothing here doesn't run before merge. In parallel under a cap, a money slice pays about 8 minutes, not 25.

**Crown:** **Visionary**, "Never twice" is the right story, but keep M out of the pre-merge gate: before merge it's just L's R6 (Value). I and L before merge, K after; the ledger built first (**Skeptic**, **PM**).

**G:** retire it. **Value** changed my mind: a test that passes on I's planted bug pins nothing. That's the cross-test without a second agent.

**Craft**, I'm taking two of yours: G-9 must go red on #1436 before it's trusted, and J's promotion lands as a PR deleting the old code, at today's gate. **Skeptic**, "fails before the old fix, passes on it" answers my re-aim worry.

- G: wow 3, value 2, craft 4, fit 3, feas 3. Retire.
- I: wow 5, value 5, craft 5, fit 5, feas 3. Before merge.
- J: wow 5, value 4, craft 5, fit 4 (up from 3: Craft's deletion PR), feas 2 (down from 3: capturing production calls is platform work). Rewrites only.
- K: wow 5, value 5, craft 5, fit 5, feas 3 (down from 4: git notes aren't pushed by default). The spine.
- L: wow 4, value 5, craft 5, fit 5, feas 5. The default.
- M: wow 5, value 5, craft 4, fit 4, feas 3. Nightly, database against UBL first.
- N: wow 4, value 5, craft 5, fit 4, feas 3. Chosen by territory.

**My dissent:** K's single recall PR touches five packages across four PRDs and lands in my queue unasked, the big PR I never ordered. One small recall PR per area.

#### User, the PM



**Owner, on 25 minutes a slice:** right, and it's my velocity killer too. A rule picks the checks, not a person. The territory decides which apply: L for money code, I for files with a fix history, N for transactions and sends. The existing risk label sets a time budget. Checks run in parallel; the wait is the slowest one, and overflow goes nightly. **Skeptic**, you close it: I's replay scores every check, and one that catches nothing retires on its own.

**Visionary, on "Never twice":** yes as the story, but not M before merge. **Craft** and **Value** showed M's pre-merge form is just L's R6. So before merge it's L and I. Nightly it's M, database against UBL first. After merge, K turns each escape into a guard. K keeps the budget short: what slips past returns as a recall.

**Value, on G:** I've changed my mind. I's planted bugs already do the cross-test without a second agent. G retires.

**Skeptic, on I:** a re-aimed test must fail before the old fix and pass on it. Worry settled.

- G: wow 4, value 2, craft 4, fit 3, feas 3. Retire. Its cross-test lives in I, not L as I said.
- I: wow 5, value 5 (up from 4), craft 4, fit 5, feas 3. The benchmark that grades every check.
- J: wow 4, value 3, craft 4, fit 3, feas 2. Unchanged. Later, offline on M's corpus.
- K: wow 5, value 5, craft 5, fit 5, feas 3. Unchanged. Build the ledger alongside L.
- L: wow 4, value 5, craft 5, fit 5, feas 4. Unchanged. M's pairings become its relations.
- M: wow 5, value 4, craft 4, fit 4, feas 3 (up from 2). Offline database against UBL is cheaper.
- N: wow 4, value 4, craft 4, fit 4, feas 3. Unchanged. Only where its territory and risk label call for it.

**My dissent:** L ships first, not K's ledger. My engineer has to merge this week. L pays on the first sub-PR; K pays only after an escape.

Cross-talk stopped after one turn: positions converged on one shape, with five dissents kept.

### The person's answer to round 2

> Crown recall and relapse and add a new one - the check code history before working especially those involved during a review or touched recently ( so we could generated rules if any from previous review and / or see why this code was changed as context to avoid breaking )

The person crowned **K (Recall) and I (Relapse)**, with a new piece they added: **read the code's history before working**.

## The crown

The moderator wrote the crowned direction, "Never Twice — the loop that remembers" (History brief before work → Relapse before merge → Recall after merge), and asked each panelist for one improvement, final scores, the dissent they keep, and an area map.

### The panel on the crown

#### Visionary



##### (a) History brief: add a read-back
Before coding, the agent commits a read-back naming each protected fix and derived rule its diff will touch. The self-check then holds the diff to it: the old fix's test and a plant of the old bug run, and rules run as checks where they can be mechanised. The sub-PR shows "read back 5 · held 5 · checked 4, judged 1". That proves the brief was used, not just generated, with nobody asked. Without it, the brief is a context dump.

##### (b) Scores
wow 5, value 5, craft 4, fit 5, feas 3
stance: Crown it. The recall PR is the screenshot and the brief is the everyday value; craft rests on keeping the brief short.

##### (c) Dissent I keep
A recall's guard must be a property (round 2's L), not one example test. A pinned invoice stops that invoice; the sibling in the next PRD walks past it.

##### (d) Area map, in build order
1. `history-brief` · History brief · Why each touched line is as it is, protected fixes with their tests, derived rules from reviews (kept only if main obeys them), plus the read-back · screens 1, 2
2. `relapse-check` · Relapse · Past fixes replayed under the port rule, old bugs planted back, failed run kept, "0 replayed" when there is no history; one `omni / self-check` run with its wall time · screens 3, 4
3. `line-ledger` · Line ledger · Git notes carried onto the squash and followed through edits, backfilled over shipped PRDs · screen 5
4. `recall` · Recall · Escape reproduced red, why the checks missed it, a sweep, a property guard red on the escaped commit and run on slices in flight, one PR per area · screens 5, 6
5. `miss-rate-record` · The record · Miss rate per area as a trend with denominator and age, and each check's catch rate on past fixes · screen 7

**Why this wedge:** it needs only git and GitHub, pays off on the next slice, and its index of fixes and their tests is the corpus Relapse replays and Recall sweeps.

#### Craft



##### (a) The brief closes itself
Each entry ends with a receipt the loop computes on the sub-PR: *kept* (the protected fix's test stayed green), *followed* (the rule's check passed) or *changed by spec §N* (test updated). The brief is shown acted on; nobody is asked.
**Empty states**, three of them, never "passed": "new files: nothing to read"; "read 41 commits, 12 PRs, 0 review threads since 2024-03: nothing protected"; "history before 2021 not readable".
**Error states**, nothing waits: history not fetched (API 403, PR link lost to a squash) prints "partial: #1398's threads not read", and Relapse replays every fix in those files. A derived rule that contradicts a confirmed law is dropped, with the reason printed.

##### (b) Scores
wow 5, value 5, craft 4, fit 5, feas 3.
stance: The right crown. Craft is 4 until the tour shows the brief as one ranked screen, not a wall.

##### (c) Dissent
"Judged, not checked" rules never get a green tick or count in the record. The model grading itself shows in grey.

##### (d) Area map, in build order
1. `history-brief` · History brief · the territory's history before each slice: why each line is there, protected fixes, derived rules, receipts · screens 1, 2
2. `line-ledger` · Line ledger · every loop-merged line, carried through the squash and later edits · screen 5
3. `relapse-replay` · Relapse · past fixes replayed before merge, under the port rule, failed first run kept · screen 3
4. `self-check-summary` · Self-check · one check run per sub-PR: receipts, what ran, what was skipped and why, catches, wall time · screen 4
5. `recall` · Recall · escape to recall PR per area: red on main, why it was missed, a sweep, a guard proven red on the escaped commit · screens 5, 6
6. `miss-rate-record` · Record · miss rate per area as a trend, with its denominator and age · screen 7

**Why this wedge:** it pays on the next slice with only git and review threads, and its fix index is what Relapse replays and Recall writes back to. The ledger is second because it must start collecting early.

#### Skeptic



**(a) History brief: what must be true.** It maps each squash commit back to its PR and reviews, from a cached index: a 90-day PR backfill here once drained the API budget and blocked the outbox check (bug 638). A fix is "protected" only when it names a regression test, and that test is pinned; a fix with no test is listed "unguarded" for Relapse to plant. It is capped, ranked by churn and reviews. A derived rule counts as checked only once it is mechanised.
Smallest proof: for each bug in `.omni-loop/delivery/bugs`, build the brief at the commit that introduced it. Does it flag that line? That is its catch rate, before any agent reads it.

**(b)** wow 5, value 5, craft 4, fit 5, feas 3. I back it if "protected" means a pinned test and the headline stays the miss rate.

**(c) Dissent: context is not evidence.** The brief is the agent's input, never proof. Only what ran counts in the self-check: plants, validated ports, mechanised rules, pinned tests. The brief stays only if it catches more relapses than no brief.

**(d) Areas, in build order**
1. `history-index` · History index and brief · an incremental index of fix commits → PRs, issues, reviews and tests, producing a capped brief with pinned protected fixes and an honest empty state · 1, 2
2. `relapse-replay` · Relapse · plants first, then validated ports; the failed run is kept and "0 replayed" is never "passed" · 3, 4
3. `derived-rules` · Rules from reviews · repeated requests that main obeys, mechanised where possible, sent to the knowledge PR · 1, 2, 4
4. `line-ledger` · Line ledger · git notes carried onto the squash commit, rebuilt from sub-PR authorship for past merges; traces escapes · 5
5. `recall` · Recall · red on main, why the checks missed, a proven-red sweep, a guard that fails on the escaped commit · 6
6. `miss-rate-record` · The record · the miss rate per area, with denominator and age · 7

Wedge: `history-index`. Every other area reads it, it needs only git and the API, and its catch rate is measurable on our own bugs in week one. I move from "ledger first": the ledger pays only after an escape.

#### Value



**(a) Relapse grades the brief, and the brief costs seconds.** Each run-1 relapse is tagged "flagged in the brief, broken anyway" (an agent miss) or "not in the brief" (a brief miss, which teaches the index). The brief is read from a history index updated on each merge to main, not dug out of git for each slice. The business gets fewer rebuild cycles and less wall time per slice: the brief proves it pays for itself in velocity.

**(b)** wow 5, value 5, craft 4, fit 5, feas 3. It answers "slop" with the team's own history, for machine minutes only, as long as the miss rate and wall time are printed together.

**(c) Dissent:** territory alone must not pick the checks. Every check, the brief's deep read included, earns its minutes by its catches per minute on this repository's replay, and drops to nightly below the bar.

**(d) Area map, build order:**
1. `history-brief` · History brief · Index commits, PRs and issues through the squash; mark protected fixes with their tests; rank hot and reviewed files; honest empty state. · screens 1, 2
2. `relapse-replay` · Relapse · Re-aim fix tests under the port rule, plant old bugs, keep run 1, grade the brief, print wall time next to catches. · screens 3, 4
3. `review-rules` · Derived rules · Mine review threads into rules kept word for word, only those main obeys; mechanise where possible; proposed until the knowledge PR. · screens 1, 2, 4
4. `line-ledger` · Line ledger · Git notes carried onto the squash commit, followed through edits, backfilled over shipped PRDs. · screen 5
5. `recall` · Recall · Trace, reproduce red, explain the miss, sweep its own lines, add a guard red on the escaped commit, one PR per area. · screens 5, 6
6. `miss-rate-record` · The record · Miss rate per area, with denominator and age, as a trend next to wall time. · screen 7

**Why this wedge:** it pays on the first slice with only git and GitHub, it is the person's own piece, and its fix index is what Relapse replays and Recall links to.

#### User, the owner



**(a) History brief.** Mine only comments that got a change: the rule cites the commit that answered me, beside my words. That change was my confirmation, so nobody asks me. Nits and threads closed without a change stay out; my later comment beats an earlier contradicting one.

**(b) Crowned concept:** wow 5, value 5, craft 4, fit 5, feas 3.
stance: The first agent I'd defend to a peer: it reads why my code is this way, proves itself on our bugs, and cleans up its misses unasked. Feasibility stays 3 until the ledger survives a real squash.

**(c) Dissent I keep.** Velocity. Printing wall time isn't enough: a check that caught nothing on its area's replay in 90 days stops running before merge, and the brief covers only lines the slice touches. Otherwise the loop remembers everything and ships nothing.

**(d) Area map, in build order:**
1. `history-brief` · History brief · the territory's commits, PRs and issues read through the squash, protected fixes marked with their tests, "no history" said honestly · screens 1, 2
2. `line-ledger` · Line ledger · git notes carried onto the squash commit, followed through edits, backfilled over shipped PRDs · screen 5
3. `relapse` · Relapse · past regression tests re-aimed (red before the fix, green on it), old bugs planted, failed runs kept, catches and wall time printed · screens 3, 4
4. `review-rules` · Rules from past reviews · comments that got a change, kept word for word only if main obeys them, mechanised where possible · screens 1, 2, 4
5. `recall` · Recall · escape traced by the ledger, red on main, why checks missed, sweep of its own lines, guard red on the escaped commit, one small PR per area · screens 5, 6
6. `miss-rate` · The record · miss rate per area with denominator and age, fed back to briefs and replays; silent checks retire · screen 7

**Why this wedge:** history-brief pays on the first slice in any repository, with no ledger or escape needed, and its history reader feeds Relapse and Rules. The ledger is second: it can't trace what it never recorded.

#### User, the PM



**(a) Brief the plan, not only the slice.** Compute the History brief once, at /omni:plan, cached per PRD and refreshed only for files that changed on main. No slice waits on a history read, and a spec line that would undo a protected fix shows in the phase-0 PR I already review, not as a high outbox item after the wave. Same gate, better facts.

**(b) Scores:** wow 5, value 5, craft 4, fit 5, feas 3
stance: The loop reads our history, keeps our fixes, owns its misses, and nobody waits.

**(c) My dissent:** most of my PRDs are new code, where Relapse says "0 replayed". Never Twice guards the second time, so L's relations from my approved acceptance criteria must guard the first.

**(d) Areas, in build order:**
1. `history-brief` · History brief · Before a slice's first line: why each touched line is so (the authors' words) and protected fixes with their tests, hot and reviewed files first. Computed at plan time. · screens 1, 2
2. `relapse` · Relapse · Before merge: past fixes replayed as re-aimed tests (port rule) and planted bugs. The failed run is kept and the result feeds the self-check summary. · screens 3, 4
3. `review-rules` · Rules from past reviews · Review threads mined into word-for-word rules, kept only if main obeys them, mechanised where possible. · screens 1, 2, 4
4. `line-ledger` · Line ledger · The loop's lines kept in git notes through the squash, backfilled from past sub-PRs, so an escape traces to its slice. · screen 5
5. `recall` · Recall · From an escape: red on main, why the checks missed it, a sweep of its own lines, the fixes, and a guard red on the escaped commit. One PR per area. · screen 6
6. `miss-rate` · The record · Miss rate per area as a trend, with denominator and age, fed back into the brief. · screen 7

**Why this wedge:** it needs only git and GitHub, pays off on the first slice, and is the person's own piece. Relapse replays what it lists, and Recall writes back into it.

Moderator's check: the Skeptic's citation of bug 638 is real (.omni-loop/delivery/bugs/0638-pr-stats-api-budget: a 90-day PR backfill exhausted the installation's GitHub API budget and blocked the outbox check).

## After the crown: the area map

The moderator merged the six panelists' maps into one: history-brief (wedge), relapse, review-rules, line-ledger, recall, miss-rate-record. The person asked for the vision tour as a cloud page before picking, then asked:

> Before doing anything else - what is your opinion as coding agent ? Would that really benefit quality - avoid PR to be rejected and last how hard/easy it would be

The moderator answered in its own voice, as a coding agent, not for the panel. In short:
- The history brief helps most and costs little: an agent's costliest mistakes are undoing a deliberate fix and ignoring unwritten team rules, both failures of context.
- Planting past bugs back into the new code is the valuable half of Relapse, and it is mostly mechanical: the old fix is reverse-applied where its lines still exist.
- Re-aiming old regression tests is the hard half: those tests already run in the suite, porting them is an AI rewrite that can weaken them, and old commits often do not run any more. The tour's replay counts are optimistic.
- Recall builds trust more than it prevents bugs, because escapes are rare.
- None of it fixes disagreements about approach, oversized pull requests, or code with no history.
- Measurement belongs in the wedge: build the brief at the commit that introduced each past bug, and check whether it would have flagged the line.

The moderator proposed a trimmed map: relapse-plants only, with re-aiming old tests held back until the plants prove their worth. The person answered:

> Ok maybe we should do this only in some code area - like the list that everyone is using - a repo used by any financial services - so we could only enable those « expensive » where it matters

Folded in: the cheap checks (a light brief, the ledger) run everywhere. The expensive ones run only in a short list of critical areas: the deep history read, review-thread mining, planted bugs, and recall sweeps and guards. A person sets the list once by pull request, never per slice. Then the person answered:

> Record the concept of « hyper vigilance «  or similar and check what tools would exist to execute to even propose code area map to a dev

The concept is recorded as **Hyper Vigilance**. "Never Twice" was its working name in the vision tour, which is kept as it was shown. The wedge became `critical-areas`: tooling proposes the critical-areas map, and a developer confirms it once. The tools found are listed under Fuel in concept.md. On this repository, the moderator ran `fallow health --hotspots`. Fallow is a dev dependency here already. It ranked 48 hotspot files by commits, churn, density and fan-in, with a trend for each. The clone was shallow, so the history behind those numbers is partial.
