---
screen: launch
status: draft
kind: page
mock: launch.html
implements: []
reads: []
routes: [/prd/<id>?tab=launch]
supersedes: null
---

## Purpose

The PRD page's Launch tab, where a PM opts a PRD into an announcement and, once it ships, posts its
launch video to Slack #release-won. Launch replaces the Pitch tab and the manual terminal run of
`/omni:pitch`; it builds on `/omni:pitch`, `kit/lib/pitch`, `kit/pitch-engine` and the product's
Pitch settings. The PM decides, Omni may suggest; nothing posts without the PM. The tab sits in the
PRD page's head and tabs, the `prd-dossier` screen. The message the head button sends to
#release-won (the MP4 uploaded as the message, three lines of text) is a Slack screen, not an Omni
one, and is not drafted here.

## Regions

- **The opt-in:** one switch, `Announce this launch`, at brainstorm or at ship, with `Omni suggests
  it` when the spec changes a screen users see. Turned on, it shows two choices, both allowed:
  `Post when shipped` and `Add to Friday`; then the three steps that follow (ships and runs on prod,
  cut in the product's look, you post and Friday sends), and a link to the product's Pitch settings,
  where the tone, look, music and voice come from. No script per PRD.
- **The head on ship day:** the head button reads `Post the launch` (the page's one primary); the
  facts strip says Merged, Prod and Launch (`ready`, `· Friday too`).
- **The launch card,** two columns:
  - the video in the product's Pitch look, cut in CI from the after footage only (the filmed walk and
    proof clips), the spec and the release note: frame 0 is the headline card, by second 3 it zooms
    on the new element; under it the player bar, then the version picker;
  - the adapt bar: one prompt line (`Ask for a change`, Adapt) and five chips: Shorter · Other music
    · Other format · Replace a shot · Plainer words;
  - the opt-in, repeated;
  - the Format select: Flash, Feature (the default), Spotlight, Tech News chapter, each with its
    length;
  - `Rides with the video`: the three lines, `🎉 *headline*`, one benefit line, `📝 Limits: …` and
    the links (Click through, Slide, PRD), each line citing its source (spec section, acceptance
    criterion).
- **Adapt:** after an adapt, the new version is a draft beside the one in use, the head button reads
  `Use this version` (it renders it in CI), a one-line diff says what changed, Undo, the chip
  `Every claim sourced`, and a panel of the new storyboard's stills with the changed shots outlined.
  Uploading your own video is a separate button.
- **The failure notice,** under the head, when the render failed or Slack refused the file: the
  reason, `Nothing posted.`, and `Retry render` as the primary; the head's `Post the launch` is
  disabled, the facts say `render failed` and `#release-won: nothing posted`. Beside the broken
  video, what people see: the PM's private Slack note (with Retry render and Open on Omni) and an
  empty #release-won.

## States

- **Opted out:** the switch off, the tab's badge `off`, the two choices hidden.
- **Opted in, before ship:** the switch on, the badge `on`, the two choices and the three steps.
- **Waiting for prod:** the PRD shipped but prod does not run the feature yet; nothing is cut.
- **Ready:** the video cut, `Post the launch` in the head, the badge `ready`.
- **Add to Friday only:** the launch waits for the Friday Tech News instead of posting.
- **Adapt draft:** a new version beside the one in use, `Use this version`, the badge `v2 draft`;
  then `v2 in use`. Undo goes back for free.
- **Adapt refused:** the check refuses any unsourced claim (such as "2× faster").
- **Render failed / Slack refused the file:** nothing reaches #release-won, not even the three lines
  alone; the PM gets the reason and Retry here and in a private Slack note. Words are kept.
- **Still:** a slide and a GIF, no render, when nothing can be filmed or rendered.

## Words

Announce this launch · Omni suggests it · Post when shipped · Add to Friday · Post the launch ·
Copy link · Merged · Prod · Launch · ready · Friday too · Version · Ask for a change · Adapt ·
Shorter · Other music · Other format · Replace a shot · Plainer words · Format · Flash · Feature ·
Spotlight · Tech News chapter · Rides with the video · Limits · Click through · Slide · PRD ·
Use this version · Undo · Every claim sourced · Changed shots outlined · Render failed in CI.
Nothing posted. · Retry render · render failed · nothing posted · Only visible to you ·
Open on Omni · No video, no post.

## Refusals

- No video, no post: a failed render or a refused file posts nothing to #release-won, never the copy
  alone.
- Nothing posts without the PM: `Post the launch` is the PM's click.
- Only after footage: no "before", no chapter drawn as a mock in a real launch.
- Every line of text cites its source; the check refuses an unsourced claim.
- No editor: no timeline, no per-word re-voicing; adapting is a prompt line and chips.
- The product's own theme only, no cinema or comic costume.
- No customer names anywhere.
- Rendering runs in CI, never on a laptop; no screen says to run a command in a terminal.

## Open questions

- Does Slack play an uploaded MP4 inline and muted in the feed? It is not documented; Craft and the
  Skeptic ask for a test post in a test channel before anything else.
- The render engine: Thomas Margraff's `demo-org/release-videos` as the provider behind
  `kit/lib/pitch/providers`, or Omni's own `kit/pitch-engine` porting its best parts (music sync,
  −16 LUFS, its check).
- The narration provider for Spotlight: free Kokoro (not installed anywhere today, French and
  English untested) or ElevenLabs with a product key; no text-to-speech provider exists today.
- Where the opt-in sits at brainstorm (the Launch tab of a PRD still at its PRD stage, as drawn, or
  the brainstorm skill itself), and when Omni suggests it.
- Where the Still fallback, the upload of your own video, Waiting for prod and the refused adapt sit
  on the tab: the vision tour does not draw them.
- Where the page's other tabs go: the tour draws abridged tab lists (Spec, Plan, Outbox, Proof,
  Launch, Retro).
- The B-E developer's dissent: the copy desk (angles, a scene strip) as the base rather than the
  exception.
- The F-E developer's dissent: whether chapters drawn as mocks can ever be honest; the crowned rule
  is after footage only.

## Source

/omni:think-big, concept #2024, crowned L on 2026-10-15: .omni-loop/delivery/inbox/concepts/2024-launch/vision.html
