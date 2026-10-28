---
id: s1-03-br-access-1-proof-as-omni-app
prd: 2573
slice: s1
rank: high
bears-on: BR-ACCESS-1
raised: 2026-10-28
wave: 1
---

## The question, in plain words

The rule on which repositories a key's job token may reach says the job runs as the key's own GitHub App, and that is no longer true: every job now runs as the Omni App. Should its proof follow the Omni App, with the rule's wording updated by its owner, @nicojustdev?

## The decision, in plain words

The token still reaches only the repositories the key may reach, so the rule's substance holds. I kept every check of that limit, dropped two that only made sense for the key's App, and added checks for jobs sent from the page; the rule's own words are left for its owner.

## The intro, for fun

A rule still names the old App in its first line.

## The punchline, for fun

Same fence, new gatekeeper: the owner picks the new words.

## The options, in plain words

A. A. Keep the amended proof, and let the owner reword the rule to name the Omni App.
B. B. Keep the amended proof and the rule's words as they are, the rule read as about the key's limit only.
C. C. Split the rule in two: one for a key's job, one for a job sent from the page.

## What I had to decide

Whether BR-ACCESS-1's proof may follow the Omni App, and how its owner rewords the rule. A suggested rewording, for the owner to adopt in their own words: When a job an API key sends runs on a runner, its Omni App token reaches only repositories the key may reach: the job's repository and, for a mega bug fix, the other repositories its product names, each only when it is in the key's allowed repositories and the App's installation holds it.
Decided by: Jev (hardToRevert 0.46) · agent said true

## What I did meanwhile

apps/galaxy/src/runners/runners.github-repositories.test.ts keeps every allow-list case (the job's own repository outside the list fails, the product's repositories are cut to the list, at a claim and at a refresh); it no longer checks that the key's sealed key was not opened or that the key's mint was recorded, since neither happens now; it gains page-sent mega bug fix cases and the product-repositories read.

## What it costs to change later

A constant: the proof's assertions. Going back means restoring PRD 2433's key-App path, which this PRD removes on purpose.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether @nicojustdev wants the rule to also say how far a job sent from the page reaches, which has no key and so no allow-list.
