---
id: s5-01-hall-of-heroes-four-to-a-page
prd: 94
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On a phone held upright, the eight best heroes of the season do not fit on one screen at a size anyone can read. How should the list be split?

## The decision, in plain words

Four heroes a page, on two pages the player turns with left and right, each page saying which page it is. The season, the column names and the three leading fleets stay on every page.

## The intro, for fun

Eight heroes, one small screen, and nobody wants to stand at the back of the photo.

## The punchline, for fun

So they pose in two rows of four, and everyone gets a turn at the front.

## The options, in plain words

A. Four heroes a page, on two pages turned with left and right, the page number shown above the fleets line. This is what was built.
B. All eight heroes on one page, with tighter rows and smaller hero pictures.
C. Five heroes on the first page and three on the second, like the five the title screen shows.

## What I had to decide

How the tall Hall of Heroes (`heroes` on the 320×288 grid) splits the eight rows the wide table shows. The spec lets a tall layout split a long list into pages the D-pad turns, and s5's done-when asks for "PAGE n/N" when the tall table takes more than one page, but neither says how many rows a page holds, nor where the page line goes.

## What I did meanwhile

`hallPages()` and `hallPage()` in `apps/galaxy/src/arcade/scenes/attract.ts` put four rows on a page (`HALL_ROWS_TALL`): five to eight heroes take two pages, one to four take one, and none takes one with its empty line. `PAGES.heroes` declares the count on the tall grid only, so s3's `act()` turns the pages with ◀ ▶, round from the last to the first (adopted item s3-01). Every page keeps the heading, the season, the column heads and the TOP FLEETS line, and shows `◀ ▶ PAGE n/N` just above that line. A row with a player's hero sprite is 34 grid px tall, so four rows leave room for a GitHub login that wraps onto a second line. The title's high-score phase keeps its five rows on one page: they fit.

## What it costs to change later

A constant: `HALL_ROWS_TALL` in `attract.ts`, and the tests in `attract.test.ts` that pin four rows and two pages. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How players read a paged table on a phone: nobody has played it yet.
- (author) Whether eight rows would stay readable on one page once real players' hero sprites and long GitHub logins fill it: only the demo galaxy, which draws no hero sprites in the table, was screenshotted.
