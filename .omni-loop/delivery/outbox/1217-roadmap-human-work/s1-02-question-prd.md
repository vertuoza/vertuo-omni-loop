---
id: s1-02-question-prd
prd: 1217
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

A roadmap question waiting for a person may hold up several of its PRDs, or none. Which PRD should the human work list show it under?

## The decision, in plain words

The first PRD the question holds up, in the order the roadmap names them. A question that holds up no PRD is shown with no PRD at all.

## The intro, for fun

One question can hold up three PRDs, and the list only has room for one name.

## The punchline, for fun

The first one in line gets the credit, and a free-floating question gets none.

## The options, in plain words

A. A. The first PRD it holds up, or none (the option built).
B. B. Always none for a question: it belongs to the roadmap, not a PRD.
C. C. One entry per PRD it holds up, each with its own key.

## What I had to decide

Which PRD number a question entry carries, since a roadmap question blocks a list of rows, possibly empty.

## What I did meanwhile

questionWork sets prd to the PRD of the first row in the question's blocks that is a row of the roadmap, and null when it blocks none. The app's slice s2 must accept a null prd on a question entry.

## What it costs to change later

One line of the kit; the app may show the PRD differently without any stored change, since the push refreshes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's entry shape has a prd field for every source but does not say which PRD a roadmap question carries
- (author) Whether slice s2's route accepts a null prd was not known when this was built: the two slices run in parallel
