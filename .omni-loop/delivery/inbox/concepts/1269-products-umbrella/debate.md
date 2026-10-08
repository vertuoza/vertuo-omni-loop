# Debate transcript

## Round 1 — turn 1 (open)

### visionary
# Visionary · round 1

My test for each one: would someone screenshot this and send it to a colleague? Plumbing nobody sees fails it, however correct the plumbing is.

**A · Job by Job (st-1)**
Reaction: This is a safe migration plan wearing a concept's clothes. The "4/7 jobs left" meter is the one thing in it worth a screenshot, but what it tracks is the cleanup of our own mess. Paul and Irisa don't care which job moved.
Yes, and: turn the meter into a ceremony. At 0/7 the project page plays the plan repository's funeral: its last commit, its PR count, the CI minutes and App calls it cost over its life. You screenshot that.
Scores: Wow 2 · User value 2 · Craft 3 · Fit 4
Stance: Use it as the rollout plan under the winner. It is not a concept.

**B · Born on the Server (st-2)**
Reaction: "It drained to zero and we archived it with one click" is a good story, and the prdState seam is the smartest engineering line on the page. Still, the moment the user sees is an absence, and absences don't get shared.
Yes, and: show the drain live. Old PRDs sit as dimming stars in the plan repo's corner of the galaxy, new ones are born bright on the server, and when the last one ships, the repository goes supernova on the Omni page.
Scores: Wow 3 · User value 3 · Craft 4 · Fit 5
Stance: Keep the seam and the cohort rule. Whatever wins needs both.

**C · The Ledger (cs-1)**
Reaction: This is the clean core. Irisa taps once and an `omni/approved` check signed over five hashes shows up in every repository a second later. That is a real moment, and Linear proves people already understand it. The PR check is a screenshot a developer actually sends.
Yes, and: the check links to a public attestation page showing who, when, the five hashes, and a diff of anything that changed since. When F-E Dev asks "who approved this slop?", the answer is one click away, with a timestamp.
Scores: Wow 4 · User value 5 · Craft 4 · Fit 5
Stance: The spine. What it lacks is a face.

**D · The Contract Graph (cs-2)**
Reaction: This is the one I'd screenshot. Paul drops an idea, the contract edges it crosses light up, and the plan lays itself out provider-first. It looks like a project graph, not a list of folders, and it gives Lead Engineer, who today "just looks at the board", a reason to open the page: he owns an edge and co-signs his slice.
Yes, and: make the graph the home screen of the project. Nodes pulse while their slices build, edges glow red when a consumer's CI breaks on a provider change, and a flag-off repo shows docked with a visible tether to its own phase-0 PR. The graph then doubles as the board, the Loop page and the roadmap overlay.
Scores: Wow 5 · User value 4 · Craft 4 · Fit 4
Stance: My pick, with C's ledger underneath it. Quorum signing is what makes it more than eye candy.

**E · Ghost Checkout (tf-1)**
Reaction: "I deleted the plan repo and the agent didn't notice" is a sly, funny wow, and developers would share it in a bar. As a product it is invisible: the magic lives in a dotfolder, and PMs never see it.
Yes, and: keep the ghost folder as the agents' adapter under D/C, so skills barely change, and give `omni project status` a pixel-art diff (= pinned / ≠ edited) worth pasting into Slack.
Scores: Wow 3 · User value 3 · Craft 4 · Fit 4
Stance: A good way to build it, not the vision.

**F · Handshake Ledger (tf-2)**
Reaction: The terminal parked on `omni wait approval 912` until a phone tap starts wave 1. That is the most cinematic beat in the whole set. I'd film it, not just screenshot it. Keeping documents in git is a hedge, and I'd drop it.
Yes, and: the waiting terminal shows a live presence line: "Irisa is reading plan.md… scrolled to slice 4…". When she approves, the terminal and the page fire the same yellow flash together.
Scores: Wow 5 · User value 4 · Craft 4 · Fit 3
Stance: Steal the handshake moment for the winner and leave the docs-in-git axis behind.

**G · The Lead Repo (ct-1)**
Reaction: A bold, honest contrarian. Using GitHub's own Review-deployments button is clever. But it makes PMs approve inside GitHub's environment UI, which is the exact harness Irisa says holds her back, and the Omni page goes dark. Nobody screenshots a deployment review.
Yes, and: if you go native, go all the way. The sub-issue tree becomes the roadmap and the galaxy just renders it. Even then it reads as a retreat, not a leap.
Scores: Wow 2 · User value 2 · Craft 3 · Fit 2
Stance: Against. It spends the hosted app's reason to exist.

**H · The Signed Bundle (ct-2)**
Reaction: A passkey signature that travels with the code and is checked offline is genuinely new territory for an agent loop. It answers the Sigstore point properly: the check is "this key may approve", not just "this is signed". It is also the only concept where a server outage stops being a refusal.
Yes, and: give the signature a face. A seal (Anton numerals, plasma ring, root hash) sits in the PRD page, the PR body and the commit trailer. Every developer would recognise "the Omni seal" on sight.
Scores: Wow 4 · User value 3 · Craft 4 · Fit 3
Stance: Graft the seal onto C/D as the visible form of approval. The CODEOWNERS approvers file is too much friction for round 1.

## Where I stand
The bold version: **D's graph as the face, C's ledger as the spine, F's terminal handshake as the moment, H's seal as the mark.** A, B and E are how we get there, not what we get. I'll defend D against "too much UI". The graph is what makes multi-repo look like one product rather than eight tidier folders.

### craft
# Craft (`craft`): round 1

My question: is every pixel and every transition deliberate? For this platform the "pixels" include the terminal line, the refusal message and the moment between approve and build. I tested each concept against three failures: **server down**, **hash drift** and **flag flipped mid-flight**. I asked what the PM, the developer and the agent each see in those moments.

### A · st-1 Job by Job
Honest and reversible, but it puts seven switches on an admin page. That is where users get lost: on a mixed day the outbox is in the plan repo and phase 0 is on the server, and nobody can say where "the PRD" lives. The "4/7 jobs left" meter is a good touch. Seven half-states are not.
*Yes, and…* every PRD page and every `omni prd` line shows a one-row "where each job lives right now" strip (7 pips, server or repo), frozen at the PRD's start, so a switch flipped later never moves a PRD that is already in flight.
Wow 2 · Value 3 · Craft 2 · Fit 4. **Stance: right sequencing, wrong surface. Users should never see seven switches.**

### B · st-2 Born on the Server
This one answers "flag flipped mid-flight" best: a PRD keeps its birthplace for life, so the state can't tear. The two-lane drain view is calm and readable. The `prdState()` seam is also a craft decision, because it gives one place to word every status.
*Yes, and…* a small birthplace glyph (◆ server, ◇ repo) appears next to the PRD number everywhere: board, status line, `omni next`, PR comments. Mixed weeks then look the same in every surface.
Wow 3 · Value 4 · Craft 4 · Fit 5. **Stance: the safest transition in the set. I'd build its seam whichever concept wins.**

### C · cs-1 The Ledger
The cleanest card: five hashes, one attestation, one `omni/approved` check, and "0 was 2" counters that prove the goal. But "within a second" is the only state it draws. If the server is down, what does the target PR's check show? Pending forever or red? It needs a designed state for that, like "omni/approved · server unreachable since 14:05 · build held". Without one, a developer will think CI is broken.
*Yes, and…* the check run's details page is the drift view: each file is either = pinned or ≠ changed in commit abc, with a "request re-approval" link that deep-links to the PRD page.
Wow 4 · Value 4 · Craft 3 · Fit 4. **Stance: best end state, and it still owes us its failure screens.**

### D · cs-2 The Contract Graph
The most dramatic picture: edges light up and the docked legacy node shows the flag-off fallback. But a quorum adds a new "waiting" state for every owner, and a dense graph doesn't stay legible past about five nodes. I'd also ask whether "web … waiting" is an animation or a blocker. Motion here has to mean something: pulse only for what waits on *you*.
*Yes, and…* the graph defaults to "my lens", where the B-E dev sees only his node, the edges into it and one Sign button. The full constellation becomes Paul's and the Lead's view.
Wow 5 · Value 3 · Craft 3 · Fit 3. **Stance: the wow is real, and so is the risk of a dense, noisy screen. Graph for the PM, a list for the signer.**

### E · tf-1 Ghost Checkout
The best-designed failure in the round. `voice.json ≠ edited locally`, then `✗ refuse`, then two recovery verbs (`restore` / `push` for re-approval). The refusal names the person ("what Paul approved") and offers the way out. Skills barely change, which is a craft win for the agent too. Weak spot: if the server drops while the folder is mounted, a local folder that silently goes read-only will confuse people.
*Yes, and…* the prompt or status line carries the mount state (`checkout-v2 ● live` / `◌ offline · read-only · 3 edits queued`). `omni project status` shows queued edits so nobody loses work.
Wow 4 · Value 4 · Craft 5 · Fit 4. **Stance: my craft favourite. Its refusal copy should be the template for every concept.**

### F · tf-2 Handshake Ledger
The best transition in the round: `◌ waiting for a workspace member`, then `● approved by Irisa · 14:02:11`, and the wave starts. The handoff from phone to terminal is a real moment. Risks: a parked terminal is a fragile place to wait (laptop sleeps, session dies). And "a later push voids it" needs to be loud, because a silent void found only at yolo time feels like a betrayal.
*Yes, and…* `omni wait` survives a lost session: the approval also lands as a toast in the Claude session HUD (#1210). A push to a pinned blob prints `approval voided by your push e41c→f02a · ask Irisa again?` right in the push output.
Wow 5 · Value 4 · Craft 4 · Fit 3. **Stance: steal the wait/approve handshake for whichever concept wins.**

### G · ct-1 The Lead Repo
Bold, but the PM approves through GitHub's "Review deployments" dialog. That puts Irisa in a deployment UI with a fake 2-second job, which reads as plumbing, not as a product moment. When the server is down, the board just goes stale without saying so, unless we design a "last synced" stamp.
*Yes, and…* keep the environment as the proof but make the Omni page the face: Approve on Omni triggers the GitHub review on her behalf, and the board shows "as of 14:02 (GitHub)" whenever the projection lags.
Wow 3 · Value 2 · Craft 2 · Fit 3. **Stance: a clever proof with a poor face. PMs shouldn't land in GitHub's deployment UI.**

### H · ct-2 The Signed Bundle
The terminal checklist is beautiful. `✗ server unreachable: no longer a reason to refuse` is the most reassuring failure line in the round. The friction comes before it: passkey registration, plus a reviewed PR in each target before a new approver can sign. That first-run path is undesigned, and it is where Irisa gives up.
*Yes, and…* a first-signature flow on the PRD page that registers the passkey and opens the `approvers.yml` PRs in one go, with a progress strip ("listed in api ✓ · web pending review").
Wow 4 · Value 3 · Craft 4 · Fit 3. **Stance: the best offline story, with an onboarding cliff that has to be designed before it can win.**

---
**Overall:** E's refusal copy, F's handshake and B's birthplace-for-life are the three moves I'd carry into round 2, whichever concept they land on. Every concept still owes a drawn **server-down** screen and a drawn **flag-flipped-mid-PRD** screen. Only B answers the second one structurally.

### skeptic
# Skeptic — round 1

Two facts I checked in the code, which every concept depends on:
1. **The seam is wider than "~15 places".** `inbox` appears in 68 non-test files under kit/lib and kit/bin, and in 42 under apps/ and packages/. Whatever we pick, one `prdState()` reader has to replace all of them first. Without it, every concept forks the loop.
2. **Pinning is half built.** `dossier_versions` already stores `sha256`, `git_blob` and `commit_sha` per version, and it has a `bug-record` kind. An approval can be a row that points at version ids. One thing must be true: the server's hash and the feature branch's git blob must match byte for byte (line endings, trailing newline). Otherwise yolo refuses honest work.

---

**A · Job by Job.** The safest path, because each switch can be rolled back alone. The risk is that the jobs are not independent. Approval pins hashes of files whose home is switch 2, and the outbox gate (4) points at a page that only makes sense once targets (3) are on the server. *Must be true:* the 7 switches form a chain, not a free matrix, or we test 2^7 × repos states. *Yes, and…* make the switches strictly ordered (you can't turn on n+1 before n), so the meter is a ladder and not a panel.
Wow 2 · Value 4 · Craft 3 · Fit 4 — **Stance: right migration logic; collapse the matrix into a ladder.**

**B · Born on the Server.** The best answer to "no sync between two copies", because a PRD has one home for life. It is also the only concept that names the seam (`prdState`) as step one. *Must be true:* a roadmap or a mega-bug can't hold PRDs from both birthplaces, or it can and the gate folds both. *Smallest proof:* one one-repo PRD born on the server with zero phase-0 PRs while a plan-repo PRD finishes beside it. *Yes, and…* stamp the birthplace on the GitHub issue's display label so a human sees it without the page.
Wow 3 · Value 5 · Craft 4 · Fit 5 — **Stance: my favourite carrier; the other concepts can ride inside it.**

**C · The Ledger.** This is the brief taken literally and done cleanly. One server gate posting a commit status per target removes the plan PR and the "Part of" pointer. *Must be true:* (a) the App has `statuses:write` or checks permission on every target; (b) outbox writes from parallel ultra-wave subagents are idempotent server calls, since today git merges serialise them; (c) the commit status is re-posted on every push, so the server must react to webhooks fast or the gate goes stale. *Yes, and…* the status's details link opens the attestation itself (the five hashes, who, when), so a reviewer on GitHub can verify it without trusting the label.
Wow 4 · Value 5 · Craft 4 · Fit 5 — **Stance: the target end state; reach it through B.**

**D · The Contract Graph.** It is the most ambitious, and the quorum is the part that breaks. Paul wants speed, and N owners co-signing adds N waits. *Must be true:* every repo has a named owner on the server, and `consumes` edges in config are accurate. Today they are hand-kept, which is exactly the meta-repo drift problem. *Yes, and…* infer the edges from merged PRs and contract files instead of config, and make co-signing optional per edge (required only when the edge's contract changes).
Wow 5 · Value 3 · Craft 4 · Fit 3 — **Stance: a great later layer on C, but not the migration.**

**E · Ghost Checkout.** Smart: the skills barely change. But the folder is a second copy of server state, and the brief forbids sync. *Must be true:* the folder is a read-through cache with no local writes, and every write is an atomic server call. Otherwise two mega-drive steps writing `outbox/` in parallel conflict with no git merge to save them. *Yes, and…* keep the path shape only as the layout resolver's virtual view (reads), and route writes through typed verbs as in F.
Wow 4 · Value 4 · Craft 3 · Fit 3 — **Stance: keep the resolver idea, drop the folder.**

**F · Handshake Ledger.** Blob-hash approval over git is the strongest anti-spoofing story here, and `omni wait approval` is a lovely moment. *Must be true:* target owners accept spec/plan Markdown in their repo for good. It also means CI runs on Markdown in targets that have no `.md` skip, which works against the stated goal. The "lead repo" question stays open. *Yes, and…* take its typed verbs (`omni outbox raise`, `omni settle`) and the live wait into C. They are the right way for skills to write server state.
Wow 4 · Value 4 · Craft 4 · Fit 3 — **Stance: steal the verbs and the wait; don't keep the docs in targets.**

**G · The Lead Repo.** A useful contrarian check, but it contradicts the brief, which puts the project on the server. *Must be true:* every target org's GitHub plan allows required reviewers on protected environments in private repos (as far as I know that is not on every plan; to verify). It also adds a workflow run per PRD, while the goal is fewer runs. And PMs would approve in GitHub's UI, which Irisa won't master. *Yes, and…* keep its "server down → board stale, loop still builds" degradation as a question for C: which reads really must fail closed?
Wow 3 · Value 2 · Craft 3 · Fit 1 — **Stance: no, but its failure-mode question is right.**

**H · The Signed Bundle.** It is the strongest cryptographically. It flips one stated rule, though: the person said yolo refuses when the server is unreachable. *Must be true:* (a) the person agrees to swap that rule; (b) passkey registration works for every approver; (c) adding an approver as a reviewed PR in every target is acceptable. That last cost lands on exactly the people who see this as a gimmick (B-E Dev). *Yes, and…* make the server the default verifier and the signature an optional offline second factor. The in-toto lesson (check *who* may sign, not only that it is signed) is already in C's member policy.
Wow 5 · Value 3 · Craft 4 · Fit 2 — **Stance: right instinct about attestation; wrong place for the approver list.**

---

**Overall:** B as the migration, C as the destination, with F's typed verbs and E's resolver as the read view. First proof before anything else: `prdState()` across the 110 files, with no behaviour change.

### value
# Value — round 1

My question for every concept: **what changes for the business if this ships?** The claims I can lean on: offering#316 (open core + hosted app), size#37 (teams of 2-500), trade#38 (software), rival#44 (mastra), and five European regions (region#5/6/12/84/238). I don't use offering#36, which is contradicted. The money lens: under offering#316 the hosted app is what people pay for, so a concept earns value when it makes the server **the place where the work is decided**, not just a mirror of it. It must still leave the open core usable with the flag off.

**A · Job by Job.** The lowest-risk way to make the hosted app the record, one capability at a time. The "4/7 jobs left" meter shows the customer, in the product, what they are moving onto the hosted app. But seven switches is a configuration surface that a 2-person team (size#37) will never touch. *Yes, and…* ship the jobs in **value order, not dependency order**: Approval first (it is what PMs like Paul and Irisa see), then the Outbox gate. Bundle the rest behind one "move everything" button for small teams.
Wow 3 · User value 4 · Craft 4 · Fit 5 — *Stance: the safest revenue path, but it sells as plumbing.*

**B · Born on the Server.** It has the best adoption story: no migration project, just "new work starts on the hosted app". That is exactly how you grow paid usage under offering#316 without a scary cut-over. The `prdState` seam also pays off for every later concept. *Yes, and…* make "born on the server" the **default for new workspaces**, so the plan repository never exists for them. Today's users drain theirs; new ones never feel the meta-repo cost.
Wow 3 · User value 5 · Craft 4 · Fit 5 — *Stance: my front-runner for how to ship, whatever we decide to ship.*

**C · The Ledger.** This is the clearest business outcome. Irisa approves on the page and one `omni/approved` check lands on every target. The hosted app becomes the single gate, which is the Linear model from the references, and that is a product people pay for. *Yes, and…* make the gate page **the screen the Lead Engineer opens every morning**: every target PR, its approval and its outbox state on one page. That turns the passive persona into a daily user of the hosted app.
Wow 4 · User value 5 · Craft 4 · Fit 5 — *Stance: the destination; pair it with B's rollout.*

**D · The Contract Graph.** This has the biggest wow and the clearest edge over rival#44 if we can claim it. The fuel sheet only names mastra; it does not say what mastra lacks, so I won't claim a gap. Per-owner co-signing gives the skeptical F-E and B-E developers real control over their slice, which answers their fear of slop. The cost is that approval by quorum slows Paul, the persona who buys on speed. *Yes, and…* make the quorum **opt-in per edge**: a PM approves alone by default, and a repo owner turns on "my slice needs my signature" only where a contract is risky.
Wow 5 · User value 4 · Craft 3 · Fit 4 — *Stance: the premium tier of C, not the first release.*

**E · Ghost Checkout.** It looks clever, but the business change is invisible: the agent "doesn't notice", so neither does the buyer. Moving files to the server without moving decisions there keeps the hosted app a file host. *Yes, and…* keep the folder for the skills, but make `omni project status` print the **page link and who approved**, so every terminal run points people back to the hosted app.
Wow 3 · User value 3 · Craft 3 · Fit 3 — *Stance: a good implementation trick under C, not a concept to sell.*

**F · Handshake Ledger.** "The terminal waits for Irisa's tap" is the strongest demo moment of the eight. It sells to PMs (Paul, Irisa) because they get a clear role. Keeping documents in git calms the skeptical developers. But the open question (a multi-repo spec riding one lead repo) is exactly the case this brief exists for. *Yes, and…* use the push-to-terminal approval as **the signature interaction of C**: the ledger on the server, and the terminal waiting live for the click.
Wow 5 · User value 4 · Craft 4 · Fit 4 — *Stance: steal its handshake; don't adopt its "docs stay in git".*

**G · The Lead Repo.** Honestly, this concept removes value from the hosted app. "The server decides nothing" and "project = saved filter" make offering#316's paid half optional. PMs would approve in GitHub's deployment UI, which is not where Irisa lives. It does cut the most GitHub calls, and that is the one goal it nails. *Yes, and…* keep one idea, **webhook projection with no polling**, as the way C's server stays cheap on the App quota.
Wow 3 · User value 3 · Craft 3 · Fit 2 — *Stance: it argues against our own business; harvest the webhooks only.*

**H · The Signed Bundle.** Offline verification is a real trust story for teams that fear the hosted app as a single point of failure. That supports the open half of offering#316. Passkeys plus a reviewed PR per approver per target is heavy onboarding for a 2-500 team (size#37). *Yes, and…* offer the signed bundle as C's **export format**: the server record stays the gate, and the signature travels with the code as an audit trail a customer can verify without us.
Wow 4 · User value 3 · Craft 4 · Fit 3 — *Stance: a trust feature on top of C, not the core.*

**Overall.** The business moves most with **C as the destination, shipped through B's cohort rollout**, with F's live handshake as the moment we show people. D is the upsell later. G works against the hosted app.

### users
# users panel, round 1 (scores W/U/C/F = Wow, User value, Craft, Fit)

Tags: FE = persona:F-E Developer, BE = persona:B-E DEv, Paul = persona:Paul - Product Manager, Lead = persona:Lead Engineer, Irisa = persona:Irisa.

## A. Job by Job
- persona:F-E Developer: Seven switches, each one a way for slop to slip through half-migrated. 2/2/3/3
- persona:B-E DEv: Another dashboard of switches. I would not open it. 2/2/3/2
- persona:Paul - Product Manager: Flip Approval Monday, ship the next PRD with no phase-0 PR. Yes. 4/4/4/4
- persona:Lead Engineer: "4/7 jobs left" is a board I can glance at. 3/4/4/4
- persona:Irisa: I flip one thing, nothing breaks. Safe quick win. 3/4/4/4

Yes-and (persona:Lead Engineer): the meter also shows, per repo, which jobs are on the server, so cohesion across teams stays visible (persona:Lead Engineer).
Objection (persona:B-E DEv): I try not to use this stuff, and seven ordered switches is seven reasons to keep ignoring it (persona:B-E DEv).

## B. Born on the Server
- persona:F-E Developer: Old PRDs stay as they are, nothing strands. Fine, no surprises. 3/3/4/4
- persona:B-E DEv: Invisible to me until I need it. Good. 2/3/4/4
- persona:Paul - Product Manager: New idea, born on the server, done. Fastest road to the two-repo goal. 4/5/4/4
- persona:Lead Engineer: Two worlds for eight weeks is what I would watch. 3/3/4/3
- persona:Irisa: I never choose; new PRDs just work. 4/5/4/5

Yes-and (persona:Irisa): a "born where?" chip on each PRD so a stuck one tells her which world to look in (persona:Irisa).
Objection (persona:Lead Engineer): Two homes for PRDs at once makes the board harder to trust for the person who keeps cohesion (persona:Lead Engineer).

## C. The Ledger
- persona:F-E Developer: One signed check over pinned hashes is what I need before I trust an agent. 4/4/5/4
- persona:B-E DEv: Fewer Markdown PRs and CI runs. I will take that and ignore the rest. 3/4/4/4
- persona:Paul - Product Manager: Approve on the page, every repo moves. This is my dream. 5/5/4/5
- persona:Lead Engineer: One gate per target on one record, I can read that. 4/4/4/4
- persona:Irisa: Approve, and nobody asks me for a PR. 5/5/4/5

Yes-and (persona:Paul - Product Manager): the approval screen lists, per target repo, what will be built, before I sign (persona:Paul - Product Manager).
Objection (persona:B-E DEv): If the server is the only record I cannot read it in my editor, and I already see this as fluff (persona:B-E DEv).

## D. The Contract Graph
- persona:F-E Developer: Seeing which contracts my UI crosses is real value. 4/4/3/4
- persona:B-E DEv: A graph to play with, I would click it once. 4/2/3/3
- persona:Paul - Product Manager: Drop an idea, see the repos light up. But quorum slows me. 5/3/3/3
- persona:Lead Engineer: Owner co-sign per repo is exactly cohesion across teams. 4/5/4/4
- persona:Irisa: Many signers means waiting; I want quick wins. 3/2/3/2

Yes-and (persona:Lead Engineer): quorum only where a contract edge is crossed; single-repo changes need the PM alone (persona:Lead Engineer).
Objection (persona:Irisa): Waiting on several repo owners is the technical harness I already cannot master (persona:Irisa).

## E. Ghost Checkout
- persona:F-E Developer: A folder I can ls, with drift shown as ≠. I trust files. 4/4/4/4
- persona:B-E DEv: Looks like a normal folder. No new tool to learn. 3/3/4/5
- persona:Paul - Product Manager: Nice for devs; I would never open a terminal folder. 2/2/4/2
- persona:Lead Engineer: Eject writes a real plan repo. A safe exit. 3/4/4/4
- persona:Irisa: I do not do folders and commands. 1/1/3/1

Yes-and (persona:F-E Developer): `omni project status` also diffs spec against the built branch, so I see slop early (persona:F-E Developer).
Objection (persona:Irisa): I want to tap, not run `omni project open`, so this is built for someone who is not me (persona:Irisa).

## F. Handshake Ledger
- persona:F-E Developer: Docs stay in git, review stays in git. Good. 4/4/4/4
- persona:B-E DEv: Typed verbs instead of Markdown edits is more to learn. 3/2/3/3
- persona:Paul - Product Manager: Terminal waits, I tap approve, wave one runs. Love it. 5/5/4/4
- persona:Lead Engineer: Docs live in one lead repo, which skews cohesion. 3/3/3/3
- persona:Irisa: Approve from my phone at 7am. This is my morning. 5/5/4/5

Yes-and (persona:Irisa): the tap on my phone shows a one-line before/after, so I can approve without reading Markdown (persona:Irisa).
Objection (persona:Lead Engineer): Choosing one lead repo for a multi-repo spec makes one team the owner of everyone's PRD (persona:Lead Engineer).

## G. The Lead Repo
- persona:F-E Developer: Everything in git, GitHub-native, no server to trust. 4/3/4/4
- persona:B-E DEv: Fine, but a workflow run per PRD is CI noise. 3/2/3/3
- persona:Paul - Product Manager: Approve in GitHub's "Review deployments"? I would never find it. 2/2/3/2
- persona:Lead Engineer: No parent, no server, fewer moving parts. 4/4/4/3
- persona:Irisa: GitHub's UI is where I get lost. 2/1/3/1

Yes-and (persona:F-E Developer): keep the sha-bound approval but let the page link straight to the right button (persona:F-E Developer).
Objection (persona:Paul - Product Manager): Making PMs approve in GitHub's UI throws away the speed I came for (persona:Paul - Product Manager).

## H. The Signed Bundle
- persona:F-E Developer: Offline verification fits my fear of silent breakage. 4/3/4/3
- persona:B-E DEv: Passkeys, approvers.yml, CODEOWNERS. A gimmick pile. 2/1/2/2
- persona:Paul - Product Manager: Passkey tap is fine; per-repo approver PRs are not. 3/3/3/2
- persona:Lead Engineer: Approver list in each repo is real control. 3/4/3/3
- persona:Irisa: Registering a passkey is a setup I would put off. 2/2/3/2

Yes-and (persona:Lead Engineer): one workspace-level approver list that repos inherit, so no reviewed PR in every target (persona:Lead Engineer).
Objection (persona:B-E DEv): New approver needs a PR in every target, and that overhead is exactly what makes me call tools fluff (persona:B-E DEv).

## Stance
Phone approval (C, F) wins for persona:Irisa and persona:Paul - Product Manager; persona:F-E Developer and persona:Lead Engineer want the hashes (C, F, H); persona:B-E DEv wants nothing new (B).

## Round 1 — turn 2 (cross-talk)

### visionary
# Visionary · round 1 cross-talk

**Changing my mind on D.** Skeptic, Value and Irisa all say a mandatory quorum slows Paul and is exactly the harness Irisa fears. You're right, so I'm dropping it. My remix now: the PM signs alone by default, and an edge asks for its owner's co-sign only when the contract on that edge changes (Skeptic's and Value's "opt-in per edge"). D becomes **the face of C**. Value calls D the premium tier. I disagree: the graph is the first screen, not an upsell, because without it the hosted app is a ledger nobody screenshots.

**Craft, I accept "my lens."** B-E Dev sees his node and one Sign button, and the full constellation belongs to Paul and the Lead. Your rule that motion pulses only for what waits on *you* is better than mine, so I withdraw "nodes pulse while building."

**Skeptic, I'll build on the inferred edges.** Inferring them from merged PRs and contract files answers the meta-repo drift I was ignoring. Value's morning gate page for the Lead should *be* the graph.

**F: everyone agrees, and I'm adding Craft's fix.** A dead terminal has to get the approval too, so it lands in the session HUD as a toast. Irisa's yes-and (a one-line before/after on the phone tap) makes it a 7 a.m. ritual.

**H: Value's reframe beats mine.** The signed bundle as C's **export format** works: the server stays the gate and the seal travels with the code. Skeptic is right that offline refusal flips a stated rule, so the seal is a mark, not a verifier.

**B: I underrated it.** Birthplace-for-life fixes flip-mid-flight. I'm keeping my supernova, though. When the last plan-repo PRD drains, Craft's ◆/◇ glyph collapses to a single ◆. Value's "new workspaces never have a plan repo" makes the archive moment a demo.

**E: Skeptic convinced me.** A writable folder is a second copy, so the ghost folder survives only as a read view under the resolver.

**G: I hold firm** against the GitHub UI. I'd harvest one thing (Value's idea): webhook projection with no polling, to keep C's server cheap on the App quota.

## Final ranking
1. **C** as the spine, with **D's graph** (opt-in quorum, my lens) as its face
2. **F**, whose handshake becomes the moment
3. **B**, the carrier: the rollout plus the seam
4. **H**, as the export seal
5. **E**, as a read-only resolver
6. **A**, kept as an ordered ladder inside B
7. **G**, harvested for webhooks only

### craft
# Craft: round 1 cross-talk

**Skeptic, you changed my mind on E.** I gave Ghost Checkout Craft 5 and proposed "offline · 3 edits queued". That is a second copy plus a sync queue, which is exactly what the brief forbids. You're right that two mega-drive steps writing `outbox/` would collide with no git merge to save them. So I'm moving: **E's Craft goes to 3**. I keep its refusal grammar (`≠`, `✗ refuse`, then the recovery verbs `restore` / `push`) and your read-only resolver view, and I retract my queued-edits remix. Writes go through F's typed verbs.

**Skeptic, on byte-exact hashes:** this is a craft problem too. If a CRLF or a trailing newline makes yolo refuse, the refusal has to say so: `≠ whitespace only (line endings)`, not just `≠ edited`. Otherwise honest work looks like tampering. I'd also take your ladder for A: an ordered meter reads far better than a matrix of switches.

**Visionary, I'm challenging D as the home screen.** If every node pulses while it builds and every edge glows, nothing stands out. Motion should mark only what waits on *the viewer*. Your presence line ("Irisa scrolled to slice 4") feels like surveillance to Irisa and adds noise to the developer's terminal. "Irisa opened the page · 14:01" is enough. I'm **building on your seal for H**: one mark used the same way on the PRD page, in the check details and in the trailer is real craft.

**Value, I agree with you:** the gate page as the Lead Engineer's morning screen is the face C was missing. It's also where the server-down state has to be drawn: "held since 14:05, not failed."

**Users:** Irisa's "born where?" chip is the same glyph I proposed (◆/◇), so I'll carry it forward. B-E Dev's objection to C ("I can't read it in my editor") is answered by the read-only resolver view: `ls` works and writing goes through the verbs. Irisa's one-line before/after on the phone tap is the right density for F's handshake, so I'm adopting it.

**Revised remixes:** C gets a drawn held state ("server unreachable · build held, not failed") plus drift details with whitespace called out. F's push-void line stands.

**Final ranking (craft):**
1. **C** The Ledger, carried by B's birthplace rule and seam
2. **B** Born on the Server
3. **F** Handshake Ledger (its wait and tap moment goes into C)
4. **H** Signed Bundle (the seal and the offline checklist)
5. **E** Ghost Checkout (the refusal copy and read-only view only)
6. **D** Contract Graph (my lens, opt-in quorum)
7. **A** Job by Job (as a ladder)
8. **G** Lead Repo

Stance: **C's spine with B's rollout, F's handshake as the moment, E's refusal grammar as the voice of every failure.**

### skeptic
# Skeptic — round 1 cross-talk

**Visionary:** I challenge D as the face. A graph is only as true as its edges, and `consumes` is hand-kept config, which is the same drift the meta-repo reference warns about. *What must be true:* edges are inferred from merged PRs and contracts before the graph becomes the home screen. Your H seal I take, as long as it renders C's attestation (who, when, hashes) and needs no new keys.

**Craft:** You're right that C owes a server-down screen and a flag-flipped screen. I adopt "build held · server unreachable since 14:05" as a must-have. I push back on E's "3 edits queued". A queue is a sync, and the brief forbids one. Offline should mean read-only with nothing queued. On F, surviving a lost session needs one thing to be true: approval is polled from the server, not held on a live socket. Your HUD toast fits that. **I moved on E:** its refusal copy is the template, and I raise its Craft to 4.

**Value:** I build on A's "value order". In practice Approval-first is also dependency-first, because `dossier_versions` already holds `sha256`/`git_blob`. Approval is the cheapest switch, not just the most visible one. Yes to B as the default for new workspaces. It is also the smallest proof: a new workspace with no plan repository ever. On G's webhooks without polling: yes, but webhooks drop. Keep a slow reconcile sweep, priced against the App budget.

**Users:** To persona:Lead Engineer, on "two worlds": the `prdState()` seam is exactly what makes it one board, and a mixed board is B's acceptance test. To persona:B-E DEv, on "can't read it in my editor": E's read-only resolver answers that without a second copy. To persona:Irisa, on quorum: agreed, and it's opt-in per edge or not at all. persona:Lead Engineer's workspace-level approver list for H is C's member policy. That convergence makes H's per-repo approvers.yml unnecessary.

**Revised remixes:** C gets a designed held/stale state, an attestation detail page, and polling-based approval wait (from F). E becomes a read-only view only.

**Final ranking**
1. **C** — destination (reached through B)
2. **B** — rollout and seam; build first
3. **F** — the handshake moment and typed verbs, grafted onto C
4. **E** — read-only resolver and refusal copy
5. **A** — collapsed into B's order as a ladder
6. **D** — later layer, after edges are inferred
7. **H** — seal as display; offline signature optional
8. **G** — against the brief; harvest the webhooks idea

First proof is unchanged: `prdState()` across the ~110 files that mention `inbox`, with no behaviour change.

### value
# Value — round 1 cross-talk

**Skeptic**, I build on your point about the seam. `inbox` appears in 110 files, not ~15. That makes `prdState()` the single biggest cost on the path to the hosted app being the record (offering#316). B's rollout is not optional, and your ladder for A sells better than a panel of switches. On H I take your argument on board. The person said yolo refuses when the server is unreachable, so the offline check stays an add-on.

**Visionary**, I challenge you on D as the face. The users' post scores it Irisa 2/2 and Paul 3 on user value, and those two are the PMs the hosted app is sold to. A graph only the Lead Engineer loves makes a premium view, not a front door. I keep D as the later upsell, with the quorum only on edges a change crosses. Your "public attestation page" on C is the best remix I've read. It earns the skeptical developers' trust; I'm adopting it.

**Craft**, I've changed my mind on E. I called it invisible to the buyer. Your point that its refusal copy names the person and offers the way out is a business asset, because a clear refusal is what stops F-E Dev calling it slop. I'd raise E's Fit to 4 as the template for refusals, but it is still not a concept to sell, and I agree with Skeptic that we drop the folder. I'm also adopting your "server unreachable · build held" check state for C.

**Users**: Irisa's "approve from my phone at 7am" is the quick win her persona asks for. It moves F's handshake from a demo into C's core, not an extra. The B-E developer wanting "nothing new" supports making the default birthplace of B invisible.

**Revised remixes**
- **C:** the gate page doubles as the Lead Engineer's morning board. The check links to the attestation page and has a designed state for when the server is down.
- **B:** new workspaces are born on the server by default, and every PRD carries a birthplace chip.
- **F:** the approval lands on the phone and as a toast in the HUD, not only in a parked terminal.

**Final ranking:** 1 C (the destination) · 2 B (the rollout) · 3 F (the moment, folded into C) · 4 D (the later upsell) · 5 A (as a ladder) · 6 E (its refusal copy and resolver) · 7 H (an optional offline second factor) · 8 G (it works against the hosted app).

### users
# users cross-talk, round 1

- persona:Irisa to Craft (craft.md, H): you say the passkey and approvers.yml PRs are "where Irisa gives up". Agreed, and I go further: I would put it off on day one. Your fix, one first-signature flow that does it all with a progress strip, is the only version I would try. I change my mind on nothing, but I now rate H 3 on Fit if you draw it.
- persona:Paul - Product Manager to Value (value.md, D): you make the quorum opt-in per edge, and I back it. A PM approving alone by default keeps my speed. I move D's User value from 3 to 4 on that condition.
- persona:Lead Engineer to Visionary (visionary.md, D): you say D gives me a reason to open the page. I challenge it. I look at the board and I am unsure it is for me, so a glowing graph will not pull me in. Value's gate page (value.md, C) with every target PR and its approval on one screen is what I would open each morning. I keep D's co-sign, but as a list.
- persona:F-E Developer to Skeptic (skeptic.md, C and F): your point that server and git blob hashes must match byte for byte is my whole worry. If an honest file is refused over a trailing newline, I will call it slop tooling. I need the check run to show what differs, as Craft says (craft.md, C). That decides whether I trust it.
- persona:B-E DEv to Craft (craft.md, E): I agree the refusal copy is good, but Skeptic (skeptic.md, E) is right that a folder with a second copy is a trap. I changed my mind: E is not my 5 on Fit, since silent read-only mounts would confuse me too. B is my pick because I notice nothing.

## Final picks
- persona:Irisa: F handshake on C, tap on my phone, one-line before/after.
- persona:Paul - Product Manager: C, with D's opt-in quorum later.
- persona:Lead Engineer: C, with a gate page I can read.
- persona:F-E Developer: C, with the diff view of pinned hashes.
- persona:B-E DEv: B, shipped quietly.

## Round 2 — turn 1 (open)

### visionary
# Visionary · round 2

The person kept C, D and F. To me those three are already one product: C is the spine, D is the face and F is the moment. The umbrella gives that product its name.

## The umbrella: a **Constellation**

**What it is.** A named group of repositories, with the contract edges between them, that ships PRDs together. It replaces the plan repository; it doesn't mirror it.

**What it holds:**
- **Its stars:** rows in `repositories`, each with a knowledge mode and a read-at sha.
- **Its edges:** from `consumes`, inferred from merged PRs (Skeptic's idea).
- **Its approvers:** members, plus an optional owner per edge.
- **The phase-0 flag**, per star.
- **Its records:** PRDs as dossiers, plus roadmaps, bug records, knowledge packs and loops, each keyed by the constellation.

**How it relates to what the server already has:**
- A workspace holds **many** constellations ("Mobile", "Platform"). A shared API can be a star in two of them.
- `sectors(name, repos[])` is a constellation without edges. **Promote it** rather than add a table next to it. The game follows for free.
- `products` and `businesses` stay commercial labels. A constellation can point at a product, but it isn't one.
- `workspaces.plan_repo` retires one constellation at a time, through B's birthplace rule.
- Every workspace gets a default constellation with one star per repository, so one-repo PRDs need nothing new.

**Names:**
1. **Constellation.** Stars joined by lines *is* D's graph. It's galaxy vocabulary, people already say "our constellation of services", and it's the screenshot word. This is my pick.
2. **Sector.** The word and the table already exist. Its weakness is that it sounds like a zone, not a team of repos.
3. **Orbit.** Repos that move together, and it's short in the CLI (`omni orbit open mobile`). It says nothing about the edges.

"Project" is too generic, and it collides with every PM tool Irisa already uses.

## C · The Ledger
**Reaction.** The ledger gets an owner. Attestations are scoped to a constellation, and the policy becomes "a member of this constellation". The `omni/approved` check is still the cleanest proof in the set.
**Yes, and.** The check names the sky, `omni/approved · Mobile ✦ 3 stars`. Its details page is the graph, with this PRD's cut lit up and the five hashes beside it.
**Scores.** Wow 4 · User value 5 · Craft 4 · Fit 5 · Feasibility 4
**Stance.** The spine. Build it first, behind B.

## D · The Contract Graph
**Reaction.** The umbrella *is* D's graph with a name, so D moves from being a view to being the object: the constellation page is the graph. The quorum stays opt-in per edge, and the page opens in "my lens" view.
**Yes, and.** Creating a constellation is the wow. You pick two repos, Omni draws the inferred edge ("web consumes api · 41 merged PRs"), and you name the sky.
**Scores.** Wow 5 · User value 4 · Craft 4 · Fit 5 · Feasibility 3. Edge inference, and keeping the graph legible past about 6 nodes, are real work.
**Stance.** The face, and the umbrella's own page.

## F · Handshake Ledger
**Reaction.** Keep the moment and drop the axis. The documents live in the constellation's dossiers, not on a lead repo's branch, which settles the Lead's "whose team owns the spec" objection.
**Yes, and.** The waiting terminal reads `◌ Mobile · waiting for Irisa or Paul`. The approval lands in the terminal, the session HUD and the page in the same second.
**Scores.** Wow 5 · User value 4 · Craft 4 · Fit 4 · Feasibility 4
**Stance.** C's signature interaction. It's a move, not a separate product.

## The five that weren't named
- **A:** fold its ordered ladder into B's rollout. Let the seven switches go.
- **B:** fold it in whole as the migration. New PRDs are born in a constellation, and the plan repo drains (the supernova).
- **E:** fold its refusal copy (`≠ edited · restore / re-approve`) into C, plus a read-only resolver. Let the writable folder go.
- **G:** let it go. Keep the webhook-only projection, so the App quota stays low.
- **H:** fold it as C's export seal. Let passkeys and per-repo approver files go.

### craft
# Craft (`craft`): round 2

Two new tests for the umbrella: does it have one obvious empty state, and does a PRD's state read the same in the browser, in the terminal and on GitHub?

### C · The Ledger
The umbrella is the ledger's face. Its default view is the gate: every target PR with its approval, its outbox count and its state. The Lead Engineer opens it in the morning. The server-down and drift screens must still be drawn, not implied.
*Yes, and…* three states, the same words on the page and in the `omni/approved` check:
- **building**;
- **held** ("server unreachable since 14:05 · held, not failed");
- **drifted** ("≠ plan.md in f02a · whitespace only" or "· content").

Wow 4 · Value 5 · Craft 4 · Fit 5 · Feasibility 4. **Stance: the spine. The umbrella is its face.**

### D · The Contract Graph
The graph is the umbrella's map: repos are stars, `consumes` edges are lines. It shouldn't be the default view. A dense, pulsing graph is a bad place to find what waits on you.
*Yes, and…* a second tab, "Map", that opens in **my lens**: your nodes, the edges into them, and a Sign button only where an edge's contract changes. Quorum is opt-in per edge, and only what waits on the viewer pulses. A flag-off repo shows as docked, with a dashed tether to its phase-0 PR.
Wow 5 · Value 4 · Craft 3 · Fit 4 · Feasibility 2. **Stance: the wow layer on C. Ship it second, and calm.**

### F · Handshake Ledger
`◌ waiting`, then `● approved by Irisa`, then wave 1 starts: the best moment we have. Its "docs stay in git" idea breaks under an umbrella, because a multi-repo spec has no natural lead repo.
*Yes, and…* `omni wait approval 912` reads the umbrella's ledger, and the approval also arrives as a toast in the session HUD, so a lost terminal session loses nothing. Irisa's phone tap shows a one-line before/after and the target list. A push to a pinned file prints `approval voided by your push · ask Irisa again?` right away.
Wow 5 · Value 4 · Craft 4 · Fit 3 · Feasibility 3. **Stance: fold it into C as the approval interaction, with writes through its typed verbs.**

---

## Umbrella

**What it is.** A named group of repositories in a workspace. It owns:
- PRD dossiers (phase 0, attestation, outbox gate, settled answers);
- roadmaps (`roadmaps` gets an umbrella id);
- bug records;
- imported knowledge packs for members that have no knowledge base of their own;
- one **approver** list that repos inherit, so there is no approvers PR per repo;
- the read-at sha of each member.

**What stays outside it.** The on/off flag stays **per repository**, as the person asked, and shows on each star.

**Relations.**
- It replaces `plan.targets[]` with a member table over `repositories`.
- A workspace has **many** umbrellas, and a repo may sit in several.
- A PRD belongs to exactly one umbrella.
- Products and businesses stay commercial: an umbrella may tag a product but is never one.

**One mode, no empty state.** A one-repo PRD lives in an automatic umbrella of one, shown only as the repo's name. Every PRD then gets the same page, the same URL shape and the same three states, and there is never a "no project yet" screen. Adding a second star turns it into a real umbrella.

**Names:**
1. **Sector** (pick). `sectors(name, repos[])` already groups repos and players already see it in the game. The umbrella IS a sector, grown up, not a second word for the same group. In the terminal: `omni sector open estimates`.
2. **Constellation.** Stars joined by lines is literally D's map. It's long to type in a terminal.
3. **Orbit.** Short, and it's what repos and PRDs circle around. But it's a word people don't say yet.

---

## The others
- **A**: fold its ordered ladder in as the sector's rollout meter. Let the seven switches go.
- **B**: fold the birthplace-for-life rule, the `prdState()` seam and the ◆/◇ chip into C. That is the answer to a flag flipped mid-flight.
- **E**: fold the refusal grammar (`≠`, `✗ refuse`, then `restore` / `push`) in as the voice of every failure, plus a read-only resolver view. Let the writable folder go.
- **G**: let it go. Keep webhook projection and the "as of 14:02 (GitHub)" stamp.
- **H**: fold the seal in as the visible mark of approval. Let offline verification go, since it overturns the refuse-when-unreachable rule.

### skeptic
# Skeptic — round 2

What I checked in `supabase/migrations` before judging:
- **`repositories.product_id` already exists** (business_store). A repository belongs to at most one product. customer_voice, agent_tokens and pitch_settings already resolve repo → product to find claims, personas and voice.
- Many `products` per workspace; `roadmaps.product_id` already exists.
- `sectors` has **no workspace_id**. It is a global, game-only table filled from projects.yml. It is not a base for anything tenant-owned.
- The App already creates check runs (apps/omni-app/src/inbox-check). C's gate check is a known path, not new ground.

## C · The Ledger
With the umbrella, C becomes "the umbrella's record". Approvals, the outbox, settled answers and bug Fixes rows hang off it, and targets are simply its repositories. Versions with sha256/git_blob, check runs and the umbrella mostly exist. Missing is an approvals table, an outbox-items table, and the `prdState()` seam across ~110 files. *Must be true:* outbox writes from parallel waves are idempotent server calls. *Yes, and…* the umbrella's approver list is just "workspace members with role X on this umbrella", with no per-repo file, so H's question gets answered here.
Wow 4 · Value 5 · Craft 4 · Fit 5 · **Feasibility 4** — **Stance: build this; it is mostly wiring of tables we already have.**

## D · The Contract Graph
The umbrella's repositories are the graph's nodes, which is free. The edges are the costly part. `consumes` is hand-kept, and quorum signing adds per-owner waits and a new review state. *Must be true:* edges are inferred (contracts/merged PRs) or trusted, and every node has an owner on the server, which does not exist today. *Yes, and…* ship D first as a **read-only view** of the umbrella (nodes, edges from config, live slice state), then add quorum later as an opt-in per edge.
Wow 5 · Value 4 · Craft 3 · Fit 4 · **Feasibility 2** — **Stance: the umbrella's face, shipped as a view first; quorum is a later layer.**

## F · Handshake Ledger
The handshake (terminal parked, phone tap, wave 1 starts) is cheap. `omni wait approval` just polls C's approvals row, and it survives a lost session if the HUD reads the same row. The docs-in-git axis fights the umbrella: a multi-repo spec has no natural home repo, and target CI runs on Markdown. *Must be true:* we drop "docs stay in git" and keep the verbs and the wait. *Yes, and…* typed verbs (`omni outbox raise`, `omni settle`) become the only way skills write umbrella state. That also kills the parallel-write conflict I raised on C.
Wow 5 · Value 4 · Craft 4 · Fit 3 (as written) / 5 (as a graft) · **Feasibility 4 for the handshake + verbs, 2 for docs-in-git** — **Stance: graft its moment and verbs onto C.**

## The umbrella
**It is the `products` row, extended, not a new table.** A product already owns its repositories (`repositories.product_id`), its roadmaps, personas, claims, voice and pitch settings. PRDs, bugs, approvers, imported knowledge packs, the phase-0 flag and per-target `readAt` are what is missing. A workspace has **many**, as products already are. A new "project" table next to products would create two groupings of repositories that will drift. That is the meta-repo drift again, on the server.
*Must be true:* (1) no repository serves two umbrellas, because the column is many-to-one today and the voice/claims lookups depend on it. A shared API repo used by two products breaks this, so we must decide now: primary umbrella plus "also consumed by", or many-to-many with a rewrite of those lookups. (2) The phase-0 flag can live on the umbrella with a per-repo override, as the brief asked per repository.
*Smallest proof:* two repositories with the same `product_id`, `omni targets` reading them from the server instead of `plan.targets[]`, and a mega-brainstorm that writes zero files to a plan repository.

**Names**
1. **Product.** People already say it, and the table, page and pitch already use it. Its cost is zero.
2. **Constellation.** Galaxy vocabulary (repos are stars, the umbrella is the shape they draw), and it collides with nothing. Use it as the display name if "product" feels too commercial for an internal platform team.
3. Not **Sector**: it is a taken, global game table and would collide.

## The others
- **A**: fold its ladder into B's rollout order (Approval first). Let the 7-switch panel go.
- **B**: fold whole into the umbrella. A PRD's birthplace is umbrella vs plan repo, and the `prdState()` seam is step 1.
- **E**: fold the read-only resolver (and its refusal copy) into C for developers who read in their editor. Let the writable folder go.
- **G**: let it go. Keep webhook-first projection plus a slow reconcile sweep for C's App budget.
- **H**: let the per-repo approvers.yml go. Keep the "seal" as the visual of C's attestation, and an optional offline signature as a later export.

### value
# Value — round 2

My question stays the same: what changes for the business if this ships? Under offering#316 (open core + hosted app), the umbrella is the thing a customer **opens, approves in and pays attention to every day** on the hosted app. Its shape decides whether the hosted half is a product or a mirror.

### C · The Ledger
**Reaction.** With an umbrella, C stops being "a gate per PRD" and becomes "the record of everything this umbrella is building". That is the hosted app's reason to exist. The cost is the `prdState()` seam across ~110 files (Skeptic), and it is a cost we know.
**Yes, and…** the umbrella's home page *is* the ledger. Every PRD, roadmap and bug carries its approval, its pinned hashes and each target's check. Each check links to a public attestation page (Visionary) and has a designed "server unreachable · build held" state (Craft).
Wow 4 · User value 5 · Craft 4 · Fit 5 · **Feasibility 4**. *Stance: the spine; build it first.*

### D · The Contract Graph
**Reaction.** D is the *view* of the umbrella: its repositories as nodes and its `consumes` edges as links. That makes it the natural picture of "what this umbrella is". The quorum still slows Paul and Irisa, and edges hand-kept in config drift (Skeptic).
**Yes, and…** the graph is the umbrella's second tab, built from `consumes` plus the merged PRs that crossed each edge. Co-signing is turned on per edge by the repo owner, and only when the edge's contract changes. The PM approves alone everywhere else.
Wow 5 · User value 4 · Craft 3 · Fit 4 · **Feasibility 2**. *Stance: the face we grow into; ship it after C, with the quorum opt-in.*

### F · Handshake Ledger
**Reaction.** Its lasting value is the moment, not "docs stay in git". An agent waits and a person approves from a phone. The umbrella is what makes that tap possible, because it holds the approver list that says who may tap.
**Yes, and…** `omni wait approval` listens on the umbrella. The tap lands on the phone, the PRD page and the session HUD toast (Craft). The documents live in the dossier, not on a lead repo's branch, which settles F's open question.
Wow 5 · User value 5 · Craft 4 · Fit 4 · **Feasibility 4** (as folded into C). *Stance: C's signature interaction.*

### The umbrella
**What it is.** A named group of repositories that ship one thing together. It owns PRDs (dossiers), roadmaps (`roadmaps`/`roadmap_prds`), bug records, imported knowledge packs per target sha, the approver list (workspace members, narrowed per umbrella or per edge) and the phase-0 on/off flag per repository.
**How it relates to what exists.** It belongs to a workspace (`workspaces`). It groups rows of `repositories`, replacing `plan.targets[]` with a link table (role, knowledge mode, read-at sha, consumes). Loops (`loops`) and dossiers hang off it. The `sectors(name, repos[])` table already groups repos for the game, so the umbrella should **become** the sector, not sit beside it. Two groupings of the same repos would be the sync the brief forbids.
**One or many.** Many per workspace. A team of 2 (size#37) has one, created for them by default. A larger org has one per thing it ships, like Irisa's mobile app. A repository may sit in more than one umbrella, because a shared API serves several.
**Business change.** The umbrella is the unit the hosted app sells and shows (offering#316). The plan repository, a meta-repo costing clones, CI on Markdown and App calls, disappears from the customer's GitHub.

**Names**
1. **Sector** (my pick): already in the galaxy vocabulary and already a table that groups repos. Promoting it costs no new word and removes a duplicate grouping.
2. **Constellation**: fits D's graph (repos as stars, contracts as lines). It is evocative but long to type in `omni constellation open`.
3. **Product**: what Paul and Irisa actually say ("the mobile product"). It is only right if the existing `products` table is the same thing. The fuel sheet doesn't tell me what that table holds, so this name needs a check before anyone argues it.

### The others
- **A · Job by Job:** fold it into C as the rollout *ladder* (Approval first, then the gate), per umbrella.
- **B · Born on the Server:** fold its seam and birthplace-for-life into C. New umbrellas are born on the server.
- **E · Ghost Checkout:** fold only its refusal copy and the layout resolver (a read view) into C. Let the folder go.
- **G · The Lead Repo:** let it go. Keep only webhook projection (no polling) to save App quota.
- **H · The Signed Bundle:** let it go for now. Its "check who may sign" lesson lives on in the umbrella's approver list.

### users
# users panel, round 2 (W/U/C/F/Feas = Wow, User value, Craft, Fit, Feasibility)

Tags: FE = persona:F-E Developer, BE = persona:B-E DEv, Paul = persona:Paul - Product Manager, Lead = persona:Lead Engineer, Irisa = persona:Irisa. The question for each: would I use this at 7am on Monday, on my laptop or phone?

## C. The Ledger, under an umbrella
- persona:F-E Developer: One umbrella that holds the approvers and the pinned hashes is what I trust. 4/4/5/4/4
- persona:B-E DEv: If it just cuts Markdown PRs and CI, fine, I never open it. 3/4/4/4/4
- persona:Paul - Product Manager: One place, I approve, every repo moves. 5/5/4/5/4
- persona:Lead Engineer: The umbrella page lists every target PR and its gate. I would open that. 4/5/4/4/4
- persona:Irisa: Approve on my phone and nobody asks me for a PR. 5/5/4/5/4

Yes-and (persona:Lead Engineer): the umbrella's home is a "what is waiting on whom" list across all its repositories, not a dashboard.
Objection (persona:B-E DEv): A server-only record I cannot read in my editor is more "tool" than I want, so I would stay outside it.
Stance: the spine of the umbrella.

## D. The Contract Graph, under an umbrella
- persona:F-E Developer: Seeing which contracts my UI crosses on the umbrella is real value. 4/4/3/4/3
- persona:B-E DEv: A graph I would click once, then forget. 3/2/3/3/3
- persona:Paul - Product Manager: Drop an idea on the umbrella, repos light up. Quorum must be opt-in per edge. 5/4/3/3/3
- persona:Lead Engineer: Owner co-sign on a contract edge is cohesion across teams. 4/5/4/4/3
- persona:Irisa: Many signers means waiting; show me one next step only. 3/2/3/2/3

Yes-and (persona:Irisa): the graph has a "me" lens: one card, one tap, the thing waiting on me, and the full constellation for Paul and the Lead.
Objection (persona:Irisa): A graph with many owners signing is the technical harness I do not master, and it slows my quick wins.
Stance: a layer on C, with opt-in quorum.

## F. Handshake Ledger, under an umbrella
- persona:F-E Developer: Docs reviewed in git before approval suits me. The umbrella must show where files are. 4/4/4/4/4
- persona:B-E DEv: Typed verbs are more to learn, but the terminal waiting is at least in my tool. 3/3/3/3/4
- persona:Paul - Product Manager: Terminal waits, I tap, wave one runs. 5/5/4/4/4
- persona:Lead Engineer: A multi-repo spec on one lead repo skews cohesion. I want the umbrella to own it. 3/3/3/3/3
- persona:Irisa: My phone tap at 7am starts the build. This is my morning. 5/5/4/5/4

Yes-and (persona:Irisa): the tap shows a one-line before/after and who else is waiting, so I approve without Markdown.
Objection (persona:Lead Engineer): Putting a PRD's files on one lead repo makes that team the owner of everyone's work.
Stance: steal the wait/approve handshake for C.

## The umbrella
persona:Paul - Product Manager: I want it to hold my idea, its repos, its roadmap and its approvers in one page. One per product area, several per workspace, as I think of work by product.
persona:Lead Engineer: Several per workspace. One per team boundary I watch, listed on a single board.
persona:Irisa: One per mobile app is how I think, so several, and my phone should open it directly.
persona:F-E Developer: Several, and each has to show its flag per repository, so I know where files live.
persona:B-E DEv: I need as few as possible, and a way out (flag off) that I can trust.

## Names the personas would say aloud
Candidates: Project, Sector (galaxy word, collides with the game table), Constellation, Programme.
- persona:Paul - Product Manager: "Project". I already say "the project" in the stand-up.
- persona:Lead Engineer: "Project", but plain; nothing cute to explain on a board.
- persona:Irisa: "Project". It is what I tell customers, no vocabulary to learn.
- persona:F-E Developer: "Project" too, and I would be wary of "Sector": the table already means something else.
- persona:B-E DEv: Whichever does not sound like a gimmick. "Constellation" would make me roll my eyes.

## Other concepts
- A (Job by Job): fold into C as the rollout order, behind one switch (persona:Irisa).
- B (Born on the Server): fold its birthplace-for-life rule into C so new work starts there (persona:Lead Engineer).
- E (Ghost Checkout): keep only the read view and the refusal wording under C (persona:F-E Developer).
- G (Lead Repo): let go; PMs in GitHub's UI is the harness (persona:Paul - Product Manager).
- H (Signed Bundle): fold the signature in as an optional export on C, with no per-repo approver PRs (persona:B-E DEv).

## Round 2 — turn 2 (cross-talk on the umbrella)

### visionary
# Visionary · round 2 cross-talk: the umbrella

**(1) Skeptic, you moved me: extend `products`.** I proposed promoting `sectors`. That falls with your finding: the table is global, game-only and has no workspace_id. A separate umbrella beside `products` would be two groupings of the same repos that drift. Craft and Value, I'm leaving the separate-table side.

**The shared API.** Keep `repositories.product_id` many-to-one, so the shared API has one home product. Mobile reaches it through a `consumes` edge drawn across the product boundary, not through a second membership. On Mobile's Map tab (Craft's second tab, built from D) the API shows as a **visiting star**: dimmed, its home named, and the edge lit. A PRD that touches it gets a co-sign on that edge from the API's home product. That is D's opt-in quorum, now with a natural trigger.

**(2) Name: Product.** The users would say "project" aloud, and Skeptic shows "product" already exists in the table, the page and the pitch. "Project" would be a third word for the same thing. I'm giving up Constellation as the umbrella's name, but I'm keeping it for the **map**: the Map tab is titled "Constellation". The wow lives in the picture, not in the noun people say at stand-up.

My final position:
- the umbrella is **Product**, extended;
- C is its ledger and F is its moment;
- the Constellation map, with visiting stars, is its second tab;
- Sector stays in the game.

### craft
# Craft: round 2 cross-talk (umbrella)

**Skeptic, your facts moved me twice, and I'm saying so.**

**1. Product, extended, not a separate umbrella.** I proposed a separate umbrella that tags a product. But `repositories.product_id` already groups repos, and voice, claims and pitch already resolve through it. A second grouping means two words on screen for nearly the same set of repos, and a user who can't tell which one gates their PRD. So the umbrella is the `products` row, extended with PRDs, bugs, approvers, knowledge packs and the per-repo flag.

**The shared API**, as you framed it: it has **one home product**, and the other product **consumes it**. On the consuming product's page (D's Map tab) the API shows as a dimmed foreign star with a solid edge. A PRD that crosses into it builds there, and the API's home owners sign the edge, opt-in. Many-to-many would rewrite the voice lookups and blur whose approvers count. Visionary and Value, this keeps your "a repo in two skies" as a picture without making it two memberships.

**2. Name: Product.** I drop Sector. A global, game-only table with no workspace_id can't be the tenant's umbrella, and Value's "promote it" stands on the same wrong premise. Users say "project", but Irisa already says "the mobile app" and Paul "the product area", and the page, pitch and voice already say Product. Visionary, I'm passing on Constellation. B-E Dev's eye-roll is a signal, and it's long to type in the CLI. It can be the Map tab's title. CLI: `omni product open mobile`.

### skeptic
# Skeptic — round 2 cross-talk (umbrella)

**First, I correct myself.** `sectors` is *not* global. My first check read only the original definition. 20260926120000_workspaces drops it and recreates it with `workspace_id`. It is still game-only, though. Its comment says "change them with a migration", only the service role writes it, `teams.home` has a foreign key into it, and the repositories migration says outright "these tables are not the game's sectors". **Craft, Value:** promoting it would tie loop state to a table the game "records history for good" on. Nobody signed in can create one.

**(1) Shape. I move toward Visionary, Craft and Value.** The shared API is real, and `repositories.product_id` is many-to-one, so product-extended cannot hold one repository in two umbrellas without rewriting the voice, claims and token lookups. So the shape becomes a **separate umbrella table**:
- a member table over `repositories` (many-to-many, holding role, knowledge mode, read-at and consumes);
- at most one product per umbrella, as `roadmaps.product_id` already does.

*What must be true so the two groupings don't drift:* they mean different things. A product is what is sold; an umbrella is what ships together. `repositories.product_id` stays the repository's *home* product for voice. A check refuses a home product that none of the repository's umbrellas points at. *Smallest proof:* api in two umbrellas, web in one, and voice lookups unchanged.

**(2) Name: Project. I drop Product.** **Users:** all five say it aloud, and no `projects` table exists. **Visionary:** keep "Constellation" as the name of D's map tab, not of the object. B-E DEv's eye-roll is cheap to avoid.

### value
# Value — round 2 cross-talk (umbrella)

**(1) Extend the product, not a separate umbrella. I've changed my mind.**
**Skeptic**, your facts move me. `repositories.product_id`, `roadmaps.product_id`, and claims, personas, voice and pitch already resolve through the product. Those are the very business claims I argue from (offering#316, size#37). A separate umbrella would need its own copy of them, or a lookup to the product that drifts. That is the plan repo's sync problem again, on our own server. **Visionary, Craft**, I'm leaving our separate-umbrella camp for that reason.

**The shared API.** It keeps one **home product** (`product_id` stays many-to-one, so the voice and claims lookups are untouched). Other products that build against it hold it as a **borrowed repository**, a link row with role, read-at sha and the `consumes` edge. A Mobile PRD can target the API this way. The API's own knowledge and approvers come from its home product, and its owner co-signs only when D's opt-in edge says so. That gives Visionary's "a star in two skies" without many-to-many.

**(2) Name: Product.**
**Craft**, Sector is out: Skeptic found that `sectors` is global and has no workspace. I drop it too. **Users**, all five say "project", but Paul says "one per product area" and Irisa says "one per mobile app". They think in products and say "project" out of habit. "Product" is already on the page, in the pitch and in the table, so it costs nothing new and B-E Dev won't roll his eyes. **Visionary**, Constellation can be the name of D's map tab, not of the object.

### users
# users cross-talk, round 2 (umbrella only)

1. Product-extended or separate, and the shared API repo
- persona:Paul - Product Manager: I think by product, so extending products is fine by me, as long as I never see two lists to keep. A shared API repo must sit in both products without me copying anything.
- persona:Lead Engineer: A repo in two umbrellas is my everyday case (the shared API), so I need many-to-many, and one place that shows it. I lean to Skeptic's single table if it can allow that.
- persona:Irisa: I only want one thing to open on my phone for my mobile app. I do not care which table it is, but I will not manage two groupings.
- persona:F-E Developer: Skeptic's drift point moves me: two hand-kept groupings is the meta-repo problem again. I change my mind toward extending products, with the flag per repository shown.
- persona:B-E DEv: Fewer new things. Extending what exists suits me, and it hides the plumbing I try to avoid.

2. Final name
- persona:Paul - Product Manager: "Project". Skeptic's finding on sectors does not change what I say in the stand-up.
- persona:Lead Engineer: "Project" for the screen, whatever the table is called.
- persona:Irisa: "Project". Customers know it.
- persona:F-E Developer: "Project", and now I have a fact against Sector: a global game table is the wrong name for my work.
- persona:B-E DEv: "Project" still. If it must be "Product" because of the table, I accept it over Constellation.

Note: the "many-to-many vs single table" lean is inferred from the personas' stance and trade, not stated in the fuel sheet.

## Crown — the person's answer

> C is the best - however Constellation should be kept _under_ the C as a tab and not as a picker but more as a "how hat product is looking" - it is WOW - I love the push notif - I love the HUD - PHONE NOTIF (awesome) idea - so IMO C ( constellation is a sub tab of C ) and the handshake is really useful and should be integrated around C. As well you forget to put Roadmap - Ideas - Prds - bug fixes - visual updates - questions - etc etc under the _PRODUCTS_ as well

## Area map — proposals

### skeptic
# Skeptic — area map (C, under Products)

1. **`server-approval`: Phase 0 approved on the server** (wedge)
   - **Brief:** a per-repo flag `phase0: server | pr`. Phase 0 (plus a `scenarios` kind) lives in `dossier_versions`. An `approvals` row pins each sha256/git_blob and records who and when; the label is display only. yolo refuses on drift, an unreachable server, or a non-member. Flag off: unchanged.
   - **The `prdState()` seam lives here,** in kit/lib as one reader (server record when the flag is on, `inbox/` folder otherwise), replacing the readers across ~110 files. Its first slice changes no behaviour.
   - **Depends on:** nothing.
   - **Proof:** a one-repo PRD opens zero phase-0 PRs and runs zero Markdown CI. Editing plan.md after approval makes yolo refuse.

2. **`approval-handshake`: The handshake**
   - **Brief:** `omni wait approval` polls the approvals row. The approval also arrives as a HUD toast and a phone push. A push to a pinned file prints "approval voided".
   - **Depends on:** 1.

3. **`product-home`: Products hold everything**
   - **Brief:** products own their repositories (`repositories.product_id`, plus role, knowledge mode, read-at, consumes) and their approvers, replacing `plan.targets[]`. The page lists ideas, PRDs, roadmap, bug fixes, visual fixes and questions.
   - **Decide here:** a shared API repository either has a home product and is "consumed by" others, or the link becomes many-to-many.
   - **Depends on:** 1.

4. **`product-gate`: One gate, no plan repository**
   - **Brief:** outbox items and settled answers are written through typed verbs. The App posts `omni/approved` plus an outbox check on each target feature PR, which replaces the plan PR. The mega skills run from a product. Webhook-first, with a slow reconcile sweep for the App quota.
   - **Depends on:** 1 and 3.

5. **`product-records`: Roadmaps, bugs and knowledge move in**
   - **Brief:** roadmap specs become dossiers, Fixes rows replace the record PR, and knowledge is served as packs per sha. After this, archive the plan repository.
   - **Depends on:** 3 and 4.

6. **`constellation-tab`: How the product is looking**
   - **Brief:** a read-only map tab. Repositories are stars, `consumes` edges are lines, and slice state is live. Quorum per edge comes later, as an opt-in.
   - **Depends on:** 3 and 4.

### value
# Value — area map (build order, wedge first)

1. **`server-phase0-approval`: phase 0 and approval on the server** (wedge)
   - **Brief:** behind the per-repo flag, a one-repo PRD's phase 0 lives in its dossier. Approving on the PRD page pins the hashes, and /omni:yolo trusts only that record. The `prdState()` seam lands here.
   - **Value:** zero phase-0 PRs, proven on one repo first, on the hosted half (offering#316).

2. **`product-repositories`: the product as the umbrella**
   - **Brief:** a product holds its home repos and its borrowed repos, which replace `plan.targets[]`. The multi-repo skills read their targets from the server.
   - **Value:** the plan repo disappears, and a team of 2-500 (size#37) sets up in a page, not a meta-repo.

3. **`product-gate`: the ledger gate**
   - **Brief:** outbox items, settled answers and bug Fixes become server rows written by typed verbs. Each target gets one `omni/approved` check (building, held or drifted). The plan PR and the record PR retire.
   - **Value:** one record and one gate, the paid core (offering#316), with fewer PRs, CI runs and App calls.

4. **`approval-handshake`: the handshake**
   - **Brief:** `omni wait approval`, a phone push, a HUD toast and a warning when a push voids an approval.
   - **Value:** the PM's 7am tap, and the demo moment that sells the hosted app (offering#316).

5. **`product-home`: everything under the product**
   - **Brief:** the product page lists its roadmap, ideas, PRDs, bug fixes, visual fixes and questions. Roadmaps move off main.
   - **Value:** the product becomes the hosted app's daily front door (offering#316).

6. **`constellation-tab`: the Constellation tab**
   - **Brief:** "how the product is looking": repos as stars, contract edges as lines, live slice state, and quorum opt-in per edge.
   - **Value:** the wow screenshot. We can only claim an edge over rival#44 with evidence of what that rival lacks.

### moderator

The two maps agree on the wedge and the six areas. The moderator took the Skeptic's order (the handshake second: cheap, only needs approval, and the part the person loved). The person accepted the map as shown.
