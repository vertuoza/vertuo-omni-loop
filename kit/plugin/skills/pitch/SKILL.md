---
name: pitch
description: Makes a launch package for a shipped PRD, for customers or for inside the company — the words from the spec and the release note only, one slow walk-through filmed on production, the wedge slide in the product's look (16:9 and 1:1) from a real frame of it, generated music, pitch.mp4, pitch-square.mp4 and pitch.gif made with ffmpeg — then sends it to the PRD's Pitch tab with omni pitch push. Refuses with one line, writing nothing, a PRD not shipped, a proof.url that is not a fixed URL, no ffmpeg or no sign-in. Never saves, deletes or changes anything on production; posts no comment, changes no PR, issue or label. Triggers on "pitch this PRD", "make a launch video", "announce PRD 7 to customers", "/omni:pitch 859 --for customers", "/omni:pitch 859 --for inside".
---

# Pitch: a launch package for a shipped PRD

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
product's look (`arcade` or `keynote`), `<url>` the production address the walk-through is filmed on.
The folder already holds `pitch.json` with the PRD, the audience, the look and the commit. A line on
stderr saying the look could not be read means the run uses arcade: say so in one line, and go on.

## 2. The words

Read the PRD's `release.md` and its spec (`omni prd <n>` names its folder), **and nothing else**:
not the code, not the issue, not the business. Write four lines for the audience:

- **hook**: at most 10 words, what the person can now do.
- **benefit**: at most 25 words, why it matters to them.
- **kicker**: `NEW IN <PRODUCT>` for customers, `SHIPPED · PRD <n>` for inside. `<PRODUCT>` is the
  product's name `omni business show --json` gives; with none, the repository's name.
- **closing**: for customers, the product's name and its home link (`<url>`); for inside,
  `#<feature PR> · v<version> · built by the loop`, the merged feature PR
  (`gh pr list --head <feature branch> --state merged`) and the release that carried it.

Words come only from the spec and the release note. Never write a number, a customer's name or a
capability that neither of them states; when one would make the line better, leave it out. Add the
four to `<dir>/pitch.json`, keeping what is there.

## 3. The walk-through

One Playwright script, `walk.spec.ts` in `<dir>`, kept beside the run for anyone to read, like
`/omni:prove`'s. It walks the feature the spec describes on `<url>`:

- Signed in with the person's own session: run `node .omni-loop/bin/omni.mjs proof session <dir>/storage-state.json`
  once, and load that storageState.
- 10 to 15 seconds, at 1920×1080, video on (`recordVideo` at 1920×1080).
- Slow enough to follow: `slowMo` of about 400 ms, a pause after each step.
- A visible cursor drawn on the page: inject a small dot that follows the mouse, and move the mouse
  to each element before clicking it.
- It films only: it asserts nothing.

**Never change production.** The walk-through may open pages, hover, scroll, and type in a field it
then leaves without sending. It never saves, submits, deletes, archives, invites, pays, answers or
changes anything, and never clicks a button whose words do any of those. When the feature cannot be
shown without a change, film the page that leads to it and stop there.

Run it with the repository's Playwright (`npx playwright test`, a config written in `<dir>`), then
copy its video to `<dir>/walk.webm`. Take **one real frame** of it, a moment that shows the feature,
as `<dir>/frame-in.png` (`ffmpeg -y -ss <seconds> -i walk.webm -frames:v 1 frame-in.png`). Never draw
a screen, never mock one up.

## 4. The slide, the music and the videos

```bash
node .omni-loop/bin/omni.mjs pitch slide <dir> --frame <dir>/frame-in.png
node .omni-loop/bin/omni.mjs pitch music <dir> --for <audience>
node .omni-loop/bin/omni.mjs pitch video <dir>
```

`slide` renders the wedge slide in the product's look, `slide.png` (1920×1080) and `slide-square.png`
(1080×1080), and the closing card and backdrop the videos use. `music` writes the audience's default
music, `music.wav`, the same every time. `video` makes `pitch.mp4` (1920×1080), `pitch-square.mp4`
(1080×1080) and `pitch.gif` (the walk-through only, at most 8 seconds, 640 pixels wide), and lists the
five files in `pitch.json`. A verb that exits `1` prints one line: print it, keep the folder, and stop.
Look at `slide.png` once before pushing: a frame that shows nothing of the feature is retaken.

## 5. Push

```bash
node .omni-loop/bin/omni.mjs pitch push <n> <dir>
```

Exit `0` prints the Pitch tab's link, then the GIF's stable link: print both. Exit `1` prints one line
(`none`, `off`, `no sign-in (omni signin)`, `unreachable`, `refused (<status>)` or `not shipped`):
print it as is, keep every file, then print `upload failed: rerun omni pitch push <n> <dir>`. Never
push a second time to get past a failure.

## Never

- Never save, delete or change anything on production; the walk-through only looks.
- Never write a word the spec and the release note do not hold, and never invent a number or a name.
- Never post a comment, and never change a PR, an issue or a label.
- Never write inside the repository's tracked tree, never commit, and never commit the run's files.
