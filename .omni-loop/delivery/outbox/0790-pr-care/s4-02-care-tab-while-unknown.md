---
id: s4-02-care-tab-while-unknown
prd: 790
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The PR care tab should only show when the PRD has a feature PR, but while the page is still asking GitHub nobody knows yet. Should the tab show in the meantime?

## The decision, in plain words

The tab stays in the bar, dimmed, until GitHub says there is no feature PR, so the tabs do not jump when the answer arrives. It also stays once the feature PR is merged, saying there is nothing left to look after.

## The intro, for fun

Is there a feature PR? The page is still waiting for GitHub to say.

## The punchline, for fun

So the tab keeps its seat until someone confirms it is really empty.

## The options, in plain words

A. Show the tab unless GitHub answered there is no feature PR, dimmed while unknown or merged (built).
B. Show it only once GitHub confirmed a feature PR, letting the tab bar change when the answer arrives.
C. Show it only while the feature PR is open.

## What I had to decide

Whether the PR care tab shows while GitHub has not answered (page streaming, or GitHub unreachable) and after the feature PR merged, or only while an answer says a feature PR exists.

## What I did meanwhile

view.ts hides the tab only for a draft or when the summary says feature is null; pending reads 'Reading GitHub…', unread reads the usual GitHub alert, merged reads 'The feature PR is merged: nothing is left to look after.' The streamed page's pending view (stream/pending.test.ts) keeps the same tab bar as the final one.

## What it costs to change later

One predicate (noFeature) in view.ts and a few test expectations.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'shown while the PRD has a feature PR' and does not say what an unknown answer or a merged PR means.
