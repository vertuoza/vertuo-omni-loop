---
id: s6-01-candidate-laws-to-lock
prd: 1726
slice: s6
rank: high
bears-on: N-PRODUCT-4
raised: 2026-10-13
wave: 4
---

## The question, in plain words

Seventeen of the product's rules are proposed as laws, the few truths that hurt people most when broken. Which ones do you lock, so that only your approval can change them, and which do you strike?

## The decision, in plain words

Nothing is locked: every candidate is only proposed, with one plain sentence saying what breaks and who gets hurt. Three truths you may want as laws have no rule written yet, so they are listed as gaps rather than invented.

## The intro, for fun

Seventeen rules applied for a promotion to law.

## The punchline, for fun

Only one person sits on the hiring panel, and it is not the agent.

## The options, in plain words

A. Lock all seventeen candidates as proposed.
B. Lock only the ones you name in your answer, and strike the rest, which stay rules.
C. Lock none yet, and keep every entry a rule.

## What I had to decide

Lock or strike each candidate. Locking one means adding its lock line on the entry, a line for it in the thesis's laws section, and approving the feature pull request as code owner. Each candidate, with what breaks if it is broken:

1. N-PRODUCT-4 — The outbox gate reads its rules from the base branch. If broken: a pull request could switch its own gate off, and every reviewer would trust a green check that means nothing.
2. N-PRODUCT-7 — A hook that cannot run never blocks a person. If broken: a person is locked out of their own terminal by a tool meant to help them.
3. N-PRODUCT-8 — The ask hooks call only the host the person configured. If broken: a person's questions and answers could be sent to a server they never chose.
4. N-PRODUCT-14 — The terminal checks compare the knowledge with the base branch. If broken: a rule quietly loses its test, and the team only learns it when the server refuses the pull request.
5. N-PRODUCT-3 — A raised question is graded by the gate's own check before it is written. If broken: a badly ranked question slips past, and the person who answers decides without the facts.
6. N-PRODUCT-13 — The install writes nothing outside its own folder but two settings keys, and never changes a value someone else set. If broken: a person's own settings are overwritten without them knowing.
7. BR-PRODUCT-3 — An agent never applies the override label to clear the gate. If broken: an agent waves its own work through, and no person answered the open questions.
8. BR-PRODUCT-5 — A feature pull request stays a draft while any question is open. If broken: a person merges work whose open decisions nobody answered.
9. BR-PRODUCT-6 — The live outbox check reads the pull request's changed files. If broken: a risky change nobody explained reaches the main branch, and the reviewer is never told.
10. BR-PRODUCT-12 — An answer, once given, never changes. If broken: the terminal acted on words the person no longer stands behind, and nobody can tell what was decided.
11. BR-PRODUCT-28 — Only a member of a workspace can link a GitHub account. If broken: a stranger ties themselves to a team and sees what the team sees.
12. BR-PRODUCT-29 — Ask mode is open to workspace members only. If broken: a stranger reads a team's questions and answers.
13. BR-PRODUCT-39 — A question that belongs to no workspace is kept and read by nobody. If broken: the question leaks to the wrong people, or its owner loses it.
14. BR-PRODUCT-59 — Only the owner sees the stored AI key's last four characters. If broken: a member copies the workspace's paid key and runs up its bill.
15. BR-PRODUCT-63 — An agent link reads only its own workspace's repositories. If broken: an agent reads another team's private work.
16. BR-PRODUCT-64 — A link stops working when its maker leaves the workspace. If broken: someone who left the team still reads its work through an agent.
17. BR-PRODUCT-94 — An answer marked as given on the page comes only from the page's own sign-in. If broken: an agent answers a question in a person's name.

Gaps, with no rule to lock yet (write one, with its test, before it can be locked):

- Only a person merges into the main branch. It is stated in the briefing and the principles, but no rule or invariant names a test for it.
- The game's ledger never rewrites history. The briefing's open question names it; no entry exists.
- No secret reaches the browser. The briefing's open question names the Supabase secret key; no entry exists.

To strike a candidate, remove its Proposed law line; it stays a rule.

Decided by: Jev (hardToRevert 0.50) · agent said true

## What I did meanwhile

Every rule and invariant now says which paths it governs. The seventeen candidates carry a Proposed law line. The thesis is drafted, says no law is locked yet, and lists what the product refuses. The settings name you as the one owner of laws, and the code owners file names you for the thesis and the three registers.

## What it costs to change later

Locking is adding one line per law and one line in the thesis; striking is removing one line. Nothing else changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's main candidates include only a person merges into main, the ledger never rewrites history, and no secret reaches the browser; none of the three has a rule or invariant here, so none is proposed, and each is listed as a gap above.
- (author) Which candidates hurt most is a judgement from each rule's text and its test; no incident record or user report was read to rank them.
- (author) This item also accounts for the change to the rule and invariant registers: each entry gained a Governs line, and seventeen a Proposed law line; no statement, id or Enforced by line changed.
