---
id: s1-01-fun-line-sentence-count
prd: 50
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the check refuse an intro or a punchline made of two short sentences, since the spec asks for one sentence while its own example punchline has two?

## The decision, in plain words

The check refuses a line only when it runs past 120 characters or is not in plain words, and plain words already allow two short sentences at most. Keeping to one sentence stays advice for whoever writes the line.

## The options, in plain words

A. Refuse a line only when it is too long or not in plain words, which allows two short sentences, the option built.
B. Also refuse a line of more than one sentence, which would refuse the spec's own example punchline.

## What I had to decide

Whether `funLineProblems` also caps an intro or a punchline at one sentence. The spec's "What a line may say" says one sentence, in plain words, "the same `plainWordsProblems` rules as the question and the decision" — and `plainWordsProblems` allows two. The spec's own example punchline in its Solution is two sentences. Acceptance criteria 2 and 3 name only the 120-character cap and the plain-words rules.

## What I did meanwhile

`funLineProblems` is `plainWordsProblems` (which refuses more than two sentences) plus the 120-character cap, and nothing else. The one-sentence rule is left to the writer: slice s3 puts it in `/omni:do-work`'s prose.

## What it costs to change later

A one-sentence cap is one more check in `funLineProblems` and a couple of tests. Any open item already carrying a two-sentence line would then fail `omni check outbox` until reworded; settled entries are never graded, so none of them is affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's two-sentence example punchline is meant as allowed, or only as an illustration of tone
