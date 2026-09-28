---
id: s3-01-individuals-without-github
prd: 328
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When someone has not linked their GitHub account, the individual rankings cannot find them. What should the table say below the top three?

## The decision, in plain words

It shows the top three, then the line asking them to link their GitHub in the arcade, the same line the rest of the page uses, rather than telling them they have no points.

## The intro, for fun

The rankings looked for you everywhere, but you never told them your GitHub name.

## The punchline, for fun

So they send you to the arcade instead of guessing you scored nothing.

## The options, in plain words

A. The top three, then the line asking to link GitHub in the arcade, the option built.
B. The top three, then No points yet this season, as for someone who has not scored.
C. The top three alone, with no line below them.

## What I had to decide

What the individuals table shows below the top 3 for a person with no GitHub login: the spec's States table says the rankings show for a player with no GitHub linked, but not what stands in place of your rows.

## What I did meanwhile

Below the top 3, the individuals table shows the dashboard's shared 'Link your GitHub in the arcade' line (Notes.tsx, linking to /play), as the hero block, the chart and the two GitHub counts do. 'No points yet this season' stays for a person the season can find by login and who has not scored.

## What it costs to change later

One line of the rankings' view (Rankings.tsx), and the value's 'no-github' case.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec and the plan name the rankings as shown for a player with no GitHub linked, and do not say what the individuals table shows in place of their rows (author)
