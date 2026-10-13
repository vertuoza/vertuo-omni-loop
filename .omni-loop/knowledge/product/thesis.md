# The omni-loop thesis

Read this page first. It says who omni-loop is for, what it promises, which truths may never break,
and what it will never do. Each rule and invariant in this folder says more; this page is the short
version.

## Who it is for

- **Product managers** who write what should be built and answer the questions agents raise.
- **Developers** who review the work and merge it.
- **Coding agents** that build the work, one small piece at a time.
- **Teams** that follow their work, and play its game, on the Omni page and in the arcade.

## What it promises

Omni Loop turns a written product idea into delivered software.
Agents build it in small, reviewable pieces, and every piece arrives as a pull request.
When an agent decides something on its own, it writes the decision down for a person to answer.
A person always has the last word: only a person merges into the main branch.
The game turns that work into points, so a team sees what it shipped and who helped.

## The laws

A law is a rule or an invariant that its owner locked: only @pierrederval can approve a change to it.

N-PRODUCT-3 — A question an agent raises is graded by the gate's own check before it is written. If broken: a badly ranked question slips past, and the person who answers decides without the facts they need.
N-PRODUCT-4 — A pull request can never change the rules it is judged by. If broken: any change could switch its own gate off, and every reviewer would trust a green check that means nothing.
N-PRODUCT-7 — A broken hook never blocks a person's message or question. If broken: a person is locked out of their own terminal by a tool meant to help them.
N-PRODUCT-8 — The ask hooks only call the address the repository set, and only on the host the session saved. If broken: a person's questions and answers could be sent to a server they never chose.
N-PRODUCT-13 — The install writes only inside its own folder. If broken: it could overwrite a person's own settings without them knowing.
N-PRODUCT-14 — The terminal checks always compare with the base branch. If broken: a rule quietly loses its test, and the team only learns it when the server refuses the pull request.
BR-PRODUCT-3 — An agent never applies the override label itself. If broken: an agent could wave its own work through the gate with no person answering the open questions.
BR-PRODUCT-5 — A feature stays a draft while any question is open. If broken: a person could merge work whose open decisions nobody answered.
BR-PRODUCT-6 — The live check always reads the changed files. If broken: a risky change nobody explained reaches the main branch, and the reviewer is never told.
BR-PRODUCT-12 — An answer never changes after it is given. If broken: the terminal acts on words the person no longer stands behind, and nobody can tell what was decided.
BR-PRODUCT-28 — Only a member of a workspace can link a GitHub account to it. If broken: a stranger could tie themselves to a team and see what that team sees.
BR-PRODUCT-29 — Ask mode lets in only the workspace's members. If broken: a stranger could read a team's questions and answers.
BR-PRODUCT-39 — A session that belongs to no workspace is never read or deleted. If broken: a question could leak to the wrong people, or its owner could lose it.
BR-PRODUCT-59 — Only the owner can see the workspace's stored AI key. If broken: a member could copy the paid key and run up the workspace's bill.
BR-PRODUCT-63 — An agent link reads only repositories in its own workspace. If broken: an agent could read another team's private work.
BR-PRODUCT-64 — An agent link stops working when its maker leaves the workspace. If broken: a person who left the team could still read its work through an agent.
BR-PRODUCT-94 — A terminal token can never mark an answer as given on the page. If broken: an agent could answer a question in a person's name.

## What it refuses

- It never merges into the main branch: a person does.
- It never lets a pull request change the rules it is judged by.
- It never blocks a person's own message or question because a tool failed.
- It never sends a person's questions anywhere but the server they chose.
- It never shows a team's work to someone outside that team.
- It never decides in silence: every choice an agent makes alone is written down for a person.
