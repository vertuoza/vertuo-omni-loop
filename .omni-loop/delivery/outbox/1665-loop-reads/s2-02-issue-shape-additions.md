---
id: s2-02-issue-shape-additions
prd: 1665
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The kit's watch over a feature finds its linked bugs by reading each bug's text, but the planned answer for a list of issues carried no text. Should the page send it?

## The decision, in plain words

Each issue in a list now carries its text, and a list may ask for closed issues as well as open or all. What closes an issue names only changes in the same repository, and a review conversation's comments carry no link.

## The intro, for fun

A list of bugs with no words in it is a very short story.

## The punchline, for fun

So each bug brings its text along, and nobody has to knock twice.

## The options, in plain words

A. A. Keep the four as built.
B. B. Keep the spec's shapes exactly, and let care read bug bodies one issue at a time.
C. C. Add each closing change's repository, and each thread comment's link, to the contract now.

## What I had to decide

Four contract choices the spec left open: IssueSchema gains body (care's linkedBugs filters by linksPrd(issue.body)); the issues query accepts state=closed beside all and open; closedBy keeps only pull requests of the same repository, since the contract names them by number alone; ThreadSchema's comments are {author, body, createdAt} as the spec writes them, without the url and avatarUrl care's CareComment reads today.

## What I did meanwhile

Built the four in apps/galaxy/src/loop/loop.contract.ts and its fixtures; s4 builds care's thread url from the change's url or leaves it null.

## What it costs to change later

Each is a field in the contract and the fixtures, changed before the kit's adapter reads them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a bug-record pull request can live in another repository than its issue; if so, closedBy needs the repository too.
