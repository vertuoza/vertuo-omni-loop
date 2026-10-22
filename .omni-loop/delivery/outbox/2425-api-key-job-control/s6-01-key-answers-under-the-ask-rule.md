---
id: s6-01-key-answers-under-the-ask-rule
prd: 2425
slice: s6
rank: high
bears-on: BR-PRODUCT-94
raised: 2026-10-22
wave: 4
---

## The question, in plain words

The rule @pierrederval decided on 9 October 2026 says an answer given on the page is taken only from the page's sign-in, never from a terminal token, so that a program never answers in a person's name. May a workspace's API key answer or dismiss the questions of a job that a key of the same workspace sent, as itself?

## The decision, in plain words

Yes: a key answers or dismisses only through the public API and only for a job a key of its workspace sent, marked as the key's with whom it said it acted for, never as given on the page nor by a person, while the page and the kit's sign-in keep the rule as it is and still refuse every token.

## The intro, for fun

A program asked a question and now wants to answer it itself.

## The punchline, for fun

The answer will carry the program's name, never a person's.

## The options, in plain words

A. A. A key answers and dismisses the questions of its workspace's key jobs through the public API, marked as the key's own; the rule gains the one sentence the spec proposes.
B. B. No key answers: the three routes are removed and the rule stays as written, so only a person on the page ever answers.

## What I had to decide

The spec proposes this one sentence for the rule, which only its owner may add: "An API key may answer or dismiss the questions of a job a key of its workspace sent; the answer is marked as given by that key, never on the page nor by a person." The rule's words hold as they are, since a key's answer is never marked as given on the page. What widens is the controller's reading of it, "a token never answers", which now lets a key answer through the public API for a job a key of its workspace sent, and nothing else. The slice builds that and leaves the rule's text and the test that proves it untouched. The amendment line the owner would add, with their words left for them:

#### Amended 2026-10-22 · @pierrederval · "<their words>"

An API key may answer or dismiss the questions of a job a key of its workspace sent; the answer is marked as given by that key, never on the page nor by a person.

## What I did meanwhile

Built the three routes and the runners' rules behind them: a key's answer and dismissal are closed in the database as the key, with whom it acted for, and read back by name; the page's routes still refuse every bearer with 403, which the tests hold; a person's answer on the page to a key's job and the page's automatic continuation keep the key as the sender of the job that resumes.

## What it costs to change later

Undoing it means removing three routes and the rules behind them in the runners' service; the rounds a key already closed keep the key that closed them, which the page and the API keep showing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the owner wants the sentence the spec proposes word for word, or the rule to name the public API explicitly.
