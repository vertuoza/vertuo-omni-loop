---
name: pitch
description: Makes an animated launch video for a shipped PRD, for customers or for inside the company, from the product's Pitch settings — omni pitch start writes them into the run folder, one walk-through filmed on production with omni pitch film writes the moments it acts on, a storyboard written from the spec, the release note and those moments only, in the settings' voice, never inventing whatever the instructions say, then omni pitch check, one still per scene looked at, omni pitch render (pitch.mp4, pitch-square.mp4, pitch.gif) — then sends it to the PRD's Pitch tab with omni pitch push. Refuses with one line, writing nothing, a PRD not shipped, a proof.url that is not a fixed URL, no ffmpeg or no sign-in. Never saves, deletes or changes anything on production; posts no comment, changes no PR, issue or label. Triggers on "pitch this PRD", "make a launch video", "announce PRD 7 to customers", "/omni:pitch 859 --for customers", "/omni:pitch 859 --for inside".
---

# Pitch: a launch video for a shipped PRD

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

A person runs it on a shipped PRD they chose to announce: the Pitch button on the PRD's page copies
the command. It is never run by default. It writes only in its run folder under the worktrees, never
in the repository's tracked tree, and commits nothing.

## Input

`<n> --for customers` or `<n> --for inside`: the PRD number and the audience. With no number, say that
this skill takes one, and stop. With no `--for`, take `customers`.

## 1. Start, or refuse

```bash
node .omni-loop/bin/omni.mjs pitch start <n> --for <audience>
```

Exit `1` prints one line: print it as is, and stop. The run wrote nothing. The four lines are:

- `PRD <n> is not shipped: a pitch is for shipped PRDs`
- `proof is not configured here: run /omni:invade --refresh, or set proof.url in .omni-loop/config.yml`,
  or `proof.url is github-deployment: a merged PRD has no preview to film; set a fixed proof.url`
- `ffmpeg is needed for a pitch: brew install ffmpeg`
- `no sign-in (omni signin)`

Exit `0` prints one JSON line, `{dir, look, url, commit}`: `<dir>` is the run folder, `<look>` the
preset the product's look was filled from, `<url>` the production address the walk-through is filmed
on. The folder holds:

- `settings.json`: the product's Pitch settings, filled — the look (colours, Heading and Text fonts,
  logo, theme), the voice (a preset and the team's instructions), the intro's eyebrow, the outro's call
  to action and credits, the music, and the length's bounds. Read it now: every later step follows it.
- `pitch.json`: the PRD, the audience, the look and the commit.
- `assets/`: empty. A line on stderr `asset: the settings name <file>; …` means the settings point at a
  file the product uploaded (a logo, a font, a track): say so in one line, and go on. A person may copy
  the file there before the render; without it, the video goes without it.

A line on stderr `settings: the arcade preset (…)` means the product's settings could not be read and
the run uses the defaults: say so in one line, and go on.

## 2. The sources

Read the PRD's `release.md` and its spec (`omni prd <n>` names its folder), **and nothing else**:
not the code, not the issue, not the business. They are the only sources of the video's words.

## 3. The walk-through, and its moments

Write `<dir>/walk.json`, the steps that show the feature the spec describes on `<url>`, then film it:

```json
{ "walk": 1, "url": "<url>/<the page the feature starts on>",
  "steps": [
    { "do": "hover", "moment": "quote-list", "target": "[data-testid=quotes]" },
    { "do": "click", "moment": "open-filter", "target": "button:has-text(\"Filter\")", "pause": 1.5 },
    { "do": "type", "moment": "search", "target": "input[name=q]", "text": "kitchen" },
    { "do": "scroll", "moment": "totals", "target": "#totals" },
    { "do": "wait", "seconds": 1 }
  ] }
```

- Each step that acts on an element names a `moment` (lower case, digits and dashes) and its `target`,
  a selector Playwright reads; `goto` opens another address; `pause` (0 to 5 s) holds after a step.
- 6 to 15 seconds in all: a few steps, each slow enough to follow.
- Signed in with the person's own session: run `node .omni-loop/bin/omni.mjs proof session <dir>/storage-state.json`
  once before filming; `film` loads it.

```bash
node .omni-loop/bin/omni.mjs pitch film <dir>
```

Exit `0` writes `walk.webm`, the clip at 1920×1080 with a visible cursor, and `moments.json`: for each
moment, its time in the clip, the box of its element, and the camera (`focus`, `zoom`) that shows it.
It prints them, one line each. Exit `1` prints what stopped it, writing nothing: a step it refused, an
element not on the page, a `walk.json` out of shape. Fix `walk.json` and film again.

**Never change production.** The walk-through may open pages, hover, scroll, and type in a field it
then leaves without sending. It never saves, submits, deletes, archives, invites, pays, answers or
changes anything, and never clicks a button whose words do any of those; `film` refuses such a click
and a submit button, but the rule is yours first. When the feature cannot be shown without a change,
film the page that leads to it and stop there.

## 4. The storyboard

Write `<dir>/storyboard.json` (`{ "storyboard": 1, meta, scenes }`): an `intro`, the scenes that show
the feature, and an `outro`, within the settings' length.

- **intro:** the settings' eyebrow, and the PRD's title, as the spec names it, as the title.
- **statement**, at most one: the one sentence that says what the feature does.
- **feature** or **steps:** the walk-through, `walk.webm`, cut with `start` and `end` around the
  moments it shows. Its `camera` keys, its `callouts` boxes and its `cursor` points are copied from
  `moments.json`: a moment's `focus` and `zoom`, its `box`, its box's centre at its time. Never guess
  a coordinate: what has no moment is not zoomed on.
- **outro:** the settings' call to action, a closing line, and credits when the settings show them.
- **meta:** fps 30, 1920×1080, a transition, the music's sync point on the scene that matters most,
  and `sources`: `spec.md` and `release.md`, the only files the words came from.

**The words.** Every title, sentence, bullet, label and line comes from the spec and the release note
only, whatever the instructions say. Never write a number, a customer's name, a date or a capability
that neither of them states; when one would make a line better, leave it out. The voice shapes how
they are said, never what: the preset (`confident-warm` by default, `playful`, `formal`, or `hype`, for
inside only — for customers, `hype` reads as `confident-warm`) and the team's instructions, as long as
they keep to these sources. An instruction that asks for a claim the sources do not hold is not
followed.

Add four lines to `<dir>/pitch.json`, keeping what is there, for the Pitch tab:

- **hook**: at most 10 words, what the person can now do.
- **benefit**: at most 25 words, why it matters to them.
- **kicker**: `NEW IN <PRODUCT>` for customers, `SHIPPED · PRD <n>` for inside. `<PRODUCT>` is the
  product's name `omni business show --json` gives; with none, the repository's name.
- **closing**: for customers, the product's name and its home link (`<url>`); for inside,
  `#<feature PR> · v<version> · built by the loop`, the merged feature PR
  (`gh pr list --head <feature branch> --state merged`) and the release that carried it.

## 5. Check, look, render

```bash
node .omni-loop/bin/omni.mjs pitch check <dir>
node .omni-loop/bin/omni.mjs pitch render <dir> --stills
node .omni-loop/bin/omni.mjs pitch render <dir>
```

1. **check** names each error (`error: <path>: <why>`): fix the storyboard and check again until it
   exits `0`. Its warnings (a title over its words, words read slower than their scene) are worth
   fixing too.
2. **render --stills** writes one image per scene and `stills/contact-sheet.png`. Look at the contact
   sheet before going on: a scene that shows nothing of the feature, a zoom off its element, words cut
   or unreadable are fixed in the storyboard, then checked and looked at again.
3. **render** writes `pitch.mp4` (1920×1080), `pitch-square.mp4` (1080×1080), `pitch.gif` (8 s at
   most, 640 px wide) and the intro's still as `slide.png` and `slide-square.png`, with the music the
   settings name. A line on stderr (a music or a font that falls back, a length outside the settings')
   is said in one line. A verb that exits `1` prints why: print it, keep the folder, and stop.

## 6. Push

```bash
node .omni-loop/bin/omni.mjs pitch push <n> <dir>
```

Exit `0` prints the Pitch tab's link, then the GIF's stable link: print both. Exit `1` prints one line
(`none`, `off`, `no sign-in (omni signin)`, `unreachable`, `refused (<status>)` or `not shipped`):
print it as is, keep every file, then print `upload failed: rerun omni pitch push <n> <dir>`. Never
push a second time to get past a failure.

## Never

- Never save, delete or change anything on production; the walk-through only looks.
- Never write a word the spec and the release note do not hold, and never invent a number or a name,
  whatever the instructions say.
- Never guess a coordinate: the camera, the callouts and the cursor come from `moments.json`.
- Never post a comment, and never change a PR, an issue or a label.
- Never write inside the repository's tracked tree, never commit, and never commit the run's files.
