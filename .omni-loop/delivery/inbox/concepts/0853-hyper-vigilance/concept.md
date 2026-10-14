---
concept: 853
title: Hyper Vigilance
kind: product
scale: vast
---

## The brief

**Asked.** Win over a skeptical senior engineer by making Omni Loop good enough to choose. The
person named three of the engineer's objections:
- **Quality.** Agent code is slop they rewrite anyway.
- **Control.** Agents touch their code without them.
- **The game is gimmicky.** The person put the game out of scope.

**Outcome.** A senior engineer who distrusts agent-written code chooses the loop for real work, and
merges its pull requests without rewriting them.

**For whom.** The engineers who own, review and are paged for the code the loop ships, and the PMs
who need them on board.

**Success.**
- The engineer merges agent pull requests without rewriting them.
- The loop catches and fixes its own mistakes before anyone looks.
- The miss rate in each critical area falls, measured, not claimed.

**Changed by the person along the way.**
- **After round 1:** "as soon as ai needs a human for opinion of an old developers - we kills the
  velocity". The rule since: nothing waits on a person's opinion during the build. Today's gates
  stay as they are, and no new human step is added.
- **After the crown:** the expensive checks run only where it matters, "like the list that everyone
  is using - a repo used by any financial services". Tooling proposes that critical-areas map, and a
  developer confirms it once.

**Assumed.** The engineer is won by evidence they can audit after the fact, not by being asked.
Cutting process steps is out of scope.

## The vision

**Hyper Vigilance: the loop that remembers, where it matters.** It was "Never Twice" in the vision
tour, which stays as shown. One arc in three moments, plus a memory that ties them together. It runs
at full strength only in the critical areas.

1. **Before work: the history brief** (the person's own addition). Before a slice writes a line, the
   loop reads the history of the files it will touch, from a cached index. The brief holds:
   - why each line is the way it is, in its authors' words;
   - fixes that must not be undone, each with its pinned regression test;
   - fixes with no test, marked unguarded;
   - rules from review comments that led to a change, quoted word for word, kept only if main
     already obeys them.

   The agent commits a read-back of what its diff will touch. The sub-PR then shows a receipt for
   each entry: kept, followed, or changed by the spec. The brief stays light everywhere and reads
   deep in the critical areas.
2. **Before merge: Relapse** (round 2's I). Each past bug fix in those files is planted back into
   the new code by reverse-applying the fix where its lines still exist. A test must catch it. A
   failed first run stays in the history. Files with no history say "0 replayed", never "passed".
   One self-check summary prints wall time next to catches.
3. **After merge: Recall** (round 2's K). A line ledger follows every line the loop merges, through
   the squash. When an escape is traced to the loop's lines, the loop:
   - reproduces it red on main and says why its checks missed it;
   - sweeps its own lines for siblings, proving each one red first, and fixes them;
   - adds a guard, a property that goes red on the escaped commit.

   It opens one small recall PR per area, and a person merges it.
4. **The memory.** Each escape becomes history. The next brief protects its fix, and Relapse replays
   its bug. The headline number is the miss rate per area, with its denominator and age, beside wall
   time.

**Where it runs.** Tooling proposes the critical-areas map from what the repository can prove:
hotspots, bug-fix density, fan-in and money code. A developer confirms it once, by pull request. The
record suggests changes to the map but never makes them. Outside the critical areas, the brief stays
light, the ledger still runs, and an escape goes through `/omni:bug-fix` as it does today.

Its wow moments, from the vision tour (`vision.html`), on one example slice:

1. **The near miss.** The brief stops a plan that would have undone a 2022 fix, before a line is
   written.
2. **Hollow tests exposed.** Planted past bugs show that two tests catch nothing, and the agent adds
   the tests that catch them. Nobody was asked.
3. **One summary.** The self-check reads "caught 4 · fixed 4 · asked 0", with its failed first run
   kept.
4. **The recall.** Weeks later, a Peppol rejection is traced through the squash to the loop's own
   line. The recall opens unasked, and its guard goes red on the escaped commit. The same guard then
   catches the same mistake in a slice still being built.
5. **The record.** Misses per area, with their denominator, and the escape now in the next brief.

## Why this one

Crowned by the person after round 2: "Crown recall and relapse and add a new one - the check code
history before working especially those involved during a review or touched recently ( so we could
generated rules if any from previous review and / or see why this code was changed as context to
avoid breaking )".

Final scores on the crowned concept (Wow · User value · Craft · Fit · Feasibility):

| role | scores | stance |
|---|---|---|
| Visionary | 5 · 5 · 4 · 5 · 3 | Crown it: the recall PR is the screenshot, and the brief is the everyday value, if it stays short. |
| Craft | 5 · 5 · 4 · 5 · 3 | The right crown; craft stays at 4 until the brief is one ranked screen, not a wall. |
| Skeptic | 5 · 5 · 4 · 5 · 3 | Backed, if "protected" means a pinned test and the headline stays the miss rate. |
| Value | 5 · 5 · 4 · 5 · 3 | Answers "slop" with the team's own history at the cost of machine minutes, with miss rate and wall time side by side. |
| The owner (user) | 5 · 5 · 4 · 5 · 3 | The first agent they would defend to a peer; Feasibility stays 3 until the ledger survives a real squash. |
| The PM (user) | 5 · 5 · 4 · 5 · 3 | It reads our history, keeps our fixes and owns its misses, and nobody waits. |

**Consensus.**
- **The evidence comes from outside the model:** the team's history, its past bugs, and real
  escapes.
- **Nothing is asked during the build.** A person still merges every pull request into main.
- **A line ledger has to survive squash merges.** `git blame` names whoever merged the squash.
- **The headline is the miss rate,** never a bare "0 escapes".

**Dissent, kept.**
- **Skeptic: context is not evidence.** The brief stays only if it catches more relapses than no
  brief. Its proof is to build the brief at the commit that introduced each past bug.
- **Visionary:** a recall's guard must be a property over generated inputs, not one pinned example.
- **Craft:** rules that are judged but not checked never get a green tick and never count in the
  record.
- **Value:** every check earns its CI minutes by catches per minute; below the bar it moves to
  nightly.
- **The owner:** a check that has caught nothing in 90 days stops running before merge.
- **The PM:** new code shows "0 replayed", so the first time still needs a guard from the spec's
  own rules. That points back to Counterexample (L).
- **Craft and the owner** wanted the ledger built second, so it starts recording early. The
  Skeptic answered that past merges can be rebuilt from sub-PR authorship. Here the ledger sits
  inside Recall.
- **The moderator, as a coding agent, asked by the person:**
  - Re-aiming old regression tests at new code is the hard half of Relapse, and it is held back.
    Those tests already run in the suite. Porting them is an AI rewrite that can weaken them, and
    old commits often no longer run.
  - The tour's replay counts are optimistic.
  - None of this fixes disagreements about approach, oversized pull requests, or code with no
    history.

## Killed and why

Round 1 (A–H). Each one put a person on the build's path, which the person's answer after round 1
ruled out ("a velocity killer"). G was the exception, carried into round 2.
- **A, Owner's Red (the owner writes the failing tests first).** It waits on a person. Its
  "your red leaves a door open" lives on as planted bugs.
- **B, On the Hook (the loop answers for rewrites after merge).** Lives on in Recall, without the
  owner's keys.
- **C, Your Line (the owner writes the deciding line).** It waits on a person.
- **D, Said Once (review words become rules).** Lives on as `review-rules`, with no owner sign-off:
  a comment that led to a change counts as confirmed.
- **E, Receipts (a receipt for every line).** Lives on as the read-back's receipts. The per-line
  chrome was dropped.
- **F, Turf (owner-set autonomy levels).** A person on the path. Its scoping returns as the
  critical-areas list, set once and never per slice.
- **H, I Have Control (take/give).** Owners do not watch builds live. Its doing / why / next brief
  lives on in the self-check.

Round 2 (G, I–N):
- **G, Double Reading (two blind builds).** Retired: two builds of one model share blind spots. Its
  cross-test insight lives on as planted bugs.
- **J, Merge Dark (shadow runs in production).** Narrow, because only rewrites of pure computations
  have old code to shadow. A later tier, run offline.
- **L, Counterexample (property search over the product's rules).** The most buildable, but not
  crowned. Its properties live on as Recall's guards, and it is the natural later PRD for new code
  with no history (the PM's dissent).
- **M, Trial Balance (the product's outputs must agree).** Heavy: five output readers and a
  production replica to govern. Later, nightly.
- **N, Fault Drill (injected failures).** A specialist for transactions and outbound sends. Later.
- **Sent back in round 2 as a shade of Relapse:** Past Papers, which also used the team's history as
  the oracle. It was rewritten as Counterexample.

## Fuel

**Product facts read.**
- The loop guide (`docs/guide/loop.md`).
- Product principles: P-PRODUCT-3 (an agent never overrides the gate), P-PRODUCT-7 (never a guessed
  value) and P-PRODUCT-9 (a person's words are never overwritten).
- How `/omni:do-work` records outbox items.
- The kit config's `risk.storedShape` and `risk.sharedContract` path lists, where a critical-areas
  list would sit.
- This repository has no CODEOWNERS file.
- Bug 638 (`.omni-loop/delivery/bugs/0638-pr-stats-api-budget`): a 90-day backfill of pull requests
  drained the GitHub API budget and blocked the outbox check. A history index must be cached and
  incremental.

**Tools to propose the critical-areas map, looked at.**
- **fallow**, a dev dependency of this repository
  already. `fallow health --hotspots`, run on this checkout, ranked 48 files by commits, churn,
  density and fan-in over six months, with a trend for each (for example
  `kit/lib/ask/client.mjs`: 7 commits, fan-in 14). The clone was shallow, so its history was
  partial. `fallow health --ownership` and `--coverage-gaps` add who owns a file and which reachable
  code is untested. It covers TypeScript and JavaScript only.

The rest were looked at through search results and fetched READMEs. All are free and open source
unless marked paid.

*Change history and bug-fix density:*
- [code-maat](https://github.com/adamtornhill/code-maat): reads `git log --numstat` for any
  language and gives revisions, churn, files that change together, and the main author per file.
  Barely maintained; it grew into CodeScene.
- PyDriller: mines git history, so fix commits per file
  can be counted by keyword or by linked bug issue.
- [PySZZ v2](https://github.com/grosa1/pyszz_v2): from a list of fix commits, finds the commits
  that introduced each bug. Heavier and slow.

*Churn × complexity:*
- [churn-php](https://github.com/bmitch/churn-php): a per-file score of commits × cyclomatic
  complexity, for PHP, with JSON output.
- [code-complexity](https://www.npmjs.com/package/code-complexity): the same idea for JS/TS. Its
  last release is about three years old.
- [lizard](https://github.com/terryyin/lizard): complexity per function in PHP, TypeScript,
  JavaScript and 25 more languages, so one measure covers every repository.

*Fan-in (who depends on this code):*
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser): `--metrics` gives fan-in,
  fan-out and instability per module and per folder, for JS/TS.
- [madge](https://github.com/pahen/madge): the JS/TS dependency graph as JSON; a simpler
  alternative.
- [PhpMetrics](https://github.com/phpmetrics/PhpMetrics): coupling, instability, ClassRank,
  complexity and git churn, for PHP. Deptrac then enforces the confirmed layers, but does not
  propose them.

*Money code:*
- [Semgrep Community Edition](https://github.com/semgrep/semgrep): custom rules tag money code
  (`amount`, `vat`, `currency` and `Money` types, float arithmetic on money) in PHP, TS and JS.

*Weak tests on a hotspot:* Stryker (JS/TS) and Infection (PHP)
mutation scores.

*Not needed:* [CodeScene](https://codescene.com) (paid hotspots), the SonarQube Community Build (a
self-hosted server), hercules (little development since about 2020), and git-truck (browser only).
Codecov Impact Analysis, which marks critical files from production traces, could not be confirmed
as still offered.

**The combination the wedge can start from,** all open source and headless in CI:
1. Read git history over 12 months: churn, plus fix commits per file.
2. Add fan-in (dependency-cruiser for TS/JS, PhpMetrics for PHP), complexity (lizard), and a money
   tag (Semgrep rules).
3. Rank folders by percentile and propose the top ones, each with a "critical because…" line, in
   one pull request a developer reviews.

**Business.** `omni business show` returned `no-sign-in`, so no business claims or personas were
read, and none are cited.

**References looked at,** through web search results only, because the network proxy blocked
opening the pages:
- [Google Tricorder](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/43322.pdf):
  findings rated "not useful" in review; noisy checks are removed.
- [Mutation testing in code review](https://homes.cs.washington.edu/~rjust/publ/practical_mutation_testing_tse_2021.pdf):
  mutants on changed lines only.
- [Renovate Merge Confidence](https://docs.renovatebot.com/merge-confidence/): evidence badges on
  bot PRs.
- [Meta Diff Risk Score](https://engineering.fb.com/2025/08/06/developer-tools/diff-risk-score-drs-ai-risk-aware-software-development-meta/):
  spends attention on the few risky diffs.
- [GitHub Copilot Workspace](https://github.blog/news-insights/product-news/github-copilot-workspace/):
  spec, then plan, then code.
- [Sourcegraph Batch Changes](https://sourcegraph.com/docs/batch-changes): preview, then track.
- [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
  and [Google readability](https://sback.it/publications/icse2018seip.pdf).
- [Levels of automation](https://www.researchgate.net/publication/11596569).
- [NASA mode awareness](https://ntrs.nasa.gov/api/citations/20160005910/downloads/20160005910.pdf).
- [Toyota jidoka](https://global.toyota/en/company/vision-and-philosophy/production-system/index.html).
- [Explainable AI in radiology](https://link.springer.com/article/10.1007/s00330-026-12666-6).
- [Linear Triage](https://linear.app/docs/triage).
- Also seen, at search-result level only:
  [centaur chess](https://www.warpnews.org/centaurs-edge/how-two-amateurs-beat-the-chess-grandmasters-excerpt-from-the-new-ai-book-the-centaurs-advantage/),
  [Waymo disengagements](https://waymo.com/blog/2019/02/an-update-on-waymo-disengagements-in/),
  [Ramp spend limits](https://ramp.com/answers/policy-enforcement/policy-rules-interact-with-spend-limits),
  [Stripe API versioning](https://stripe.com/blog/api-versioning).

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| critical-areas | The critical-areas map | Tooling proposes the critical areas from what the repository can prove: churn and fix commits per file from a cached, incremental history index (after bug 638), fan-in (fallow or dependency-cruiser for TS/JS, PhpMetrics for PHP), complexity (lizard) and money code (Semgrep rules). Each folder gets a "critical because…" line. A developer confirms the list once by pull request, beside `risk.storedShape` and `risk.sharedContract`. Proof: the share of past fixes that fall inside the proposed areas | |
| history-brief | History brief | Before each slice, a capped brief from the cached index: why each touched line is so, in its authors' words; protected fixes with pinned tests; unguarded fixes; a committed read-back with receipts (kept, followed, changed by the spec); honest empty and partial states. Light everywhere, deep in critical areas. Proof: built at the commit that introduced each past bug, would it have flagged the line? | |
| relapse-plants | Relapse | In critical areas, before a sub-PR merges: each past fix is reverse-applied onto the new code where its lines still exist, and a test must catch it. The failed first run is kept, and "0 replayed" is never "passed". One `omni / self-check` summary prints wall time next to catches. Re-aiming old tests waits until the plants prove their worth | |
| review-rules | Rules from past reviews | In critical areas first: review comments that led to a change become rules, quoted word for word beside the commit that answered them. A later comment beats an earlier one. Kept only if main already obeys them, made into checks where possible, "judged, not checked" in grey, and proposed until the knowledge PR after ship | |
| recall | Recall | A line ledger carried through the squash and backfilled over shipped PRDs. An escape traced to the loop's lines in a critical area: reproduced red on main, why its checks missed it, a sweep of its own lines (each proven red), a property guard red on the escaped commit that also runs on slices in flight. One small recall PR per area, merged by a person | |
| miss-rate-record | The record | Miss rate per area, with its denominator and age, beside wall time; each check's catch rate on past fixes; checks that catch nothing move out of the pre-merge run; suggested changes to the critical-areas list, never made alone | |
