---
concept: 2024
title: Launch — every shipped feature announced in #release-won with a video that plays inline
kind: product
scale: vast
---

## The brief

When a feature that someone chose to announce ships through Omni Loop, an internal announcement lands in Slack
#release-won. It should make colleagues want to watch, in the tone of "let me introduce our new feature". It should be at
least as good as the posts Thomas Margraff writes by hand today, such as the Supplier invoices "What's New" of 2026-10-08:
the problem before, what changed, the benefit, a note on limits, and a screen recording.

What the person (Martin) said, with Pierre Derval, who owns the topic:

- **Where it lives:** inside Omni's delivery flow, not in a separate marketing tool. Omni already films E2E and proof
  videos, and anything outside delivery does not get done.
- **Opt-in:** per PRD, never by default for all, since many PRDs are technical and not worth a video or its storage.
  It is chosen at brainstorm or when the PRD concludes, and once chosen the rest runs on its own. Omni may suggest; the
  PM decides.
- **Approval:** the PM of the PRD reviews on the Omni page. Nothing posts without them.
- **Narration and music:** free by default. A product can plug in an optional paid provider, such as ElevenLabs.
- **Existing work:** everything may be redone, including `/omni:pitch` (PRD 859), the Pitch studio and its
  per-product settings (PRD 1108), and the release notes (PRD 262).
- **Pierre's notes on today's Pitch:**
  - The two voices are unused.
  - The styles are basic.
  - There is no intro or outro.
  - There is no Slack automation.
- **Round 1:** keep the click-through and the copy desk. Opt-in must be light, since tones already live in the product
  settings. Use the Vertuoza theme only, with no cinema or comic costume. A recurring roll-up needs a nicer format than a
  Nintendo Direct. Adjusting a video matters, but not at any cost. Drop the "asked by" idea, which they are working on
  elsewhere.
- **Round 2:** drop the "before", which is too hard to get and often absent for a brand-new feature. The video must be
  uploaded *in* the Slack message, because people don't like to read #release-won. The Friday "Tech news" is a list
  they choose what goes into, sent automatically, with each feature getting its own presentation.
- **Their standards:**
  - a group video or one per PRD;
  - fixed formats, several of them;
  - a video generated from scratch, from screenshots or prompts;
  - generated videos can be adapted;
  - time saved, with quality and efficiency.
- **At the crown:** if a video could not be generated, the message must not go to Slack. Build on the existing
  `/omni:pitch` skill and the product settings. A colleague has a local engine for Vertuoza-branded release videos that
  could be integrated: `vertuoza/release-videos`, by Thomas Margraff.

What was assumed:

- The features announced are those of the Vertuoza products delivered through Omni, and of Omni itself.
- Success means Thomas no longer writes these posts by hand, and the posts are watched more than today.
- No customer names appear anywhere.
- Rendering moves off the laptop.

## The vision

**Launch: Ready on ship × Friday Tech News.** A launch is a video in the product's own brand that plays inline as the
Slack message, with three lines of text.

- **One toggle per PRD.** "Announce this launch", at brainstorm or at ship, with **Post when shipped** and/or **Add to
  Friday**. The tone, look, music and voice come from the product's Pitch settings, so there is no script per PRD.
- **Per PRD.** Once the PRD ships and prod runs the feature ("Waiting for prod" until then), CI cuts the video. It uses
  only the *after* footage (the filmed walk and proof clips), the spec and the release note. The PRD page's head button
  reads **"Post the launch"**. Launch replaces the Pitch tab.
- **Friday Tech News.** Under Products › <product> › Tech News, "Week 42" lists the week's launches added to Friday,
  each one line with its PM, who can untick it. At 11:00 on Friday it sends itself: one group video with a brand cover,
  a 10–15 s chapter per feature in its own presentation, and an outro. Under two items it skips. It never holds back a
  launch set to "Post when shipped".
- **Fixed formats.** All are in the product's Pitch look; for Vertuoza that is ink #08104D, accent #3D5AFE, cta
  #FF4217 and Gantari.

  | Format | Length | Contents | For |
  |---|---|---|---|
  | **Flash** | 10–15 s | one shot and a caption | quick wins |
  | **Feature** | 25–40 s | an intro, 3–4 shots zooming on the new element, captions, a Limits card and an outro | the default |
  | **Spotlight** | 45–60 s | steps, optional narration (free Kokoro, or ElevenLabs with a product key) and the slide | big features |
  | **Tech News** | 60–120 s | a cover and one chapter per feature | the Friday group video |
  | **Still** | no render | a slide and a GIF | when nothing can be filmed or rendered |

- **From scratch.** "New video" takes screenshots and/or a prompt, with or without a PRD, and builds the same storyboard,
  check, render and post. The words come only from what was given plus the linked spec and release note.
- **Adapt, without an editor.**
  - One prompt line plus chips: Shorter · Other music · Other format · Replace a shot · Plainer words.
  - Claude rewrites the storyboard within its schema, and the check refuses any unsourced claim ("2× faster").
  - A strip of changed stills shows the diff, and each adapt becomes a new version in the tab's version picker. "Use
    this version" renders it, and Undo is free.
  - Uploading your own video is a separate button.
- **The Slack message is the video.**
  - The MP4 is uploaded *as* the message, so the player is in the feed.
  - Frame 0 is the headline card, and by second 3 the video zooms on the new element.
  - Three lines go with it: `:tada: *headline*`, one benefit line, then `:memo: Limits: …` and the links (Click through,
    Slide, PRD).
- **No video, no post.** If the render failed or Slack refused the file, nothing reaches #release-won, not even the copy
  alone. The PM gets the reason and Retry on the Launch tab and in a private Slack note. The same holds for a Tech News
  edition whose group video failed.

Its wow moments:

- At 11:00 on Friday, #release-won plays "Vertuoza Tech News · Week 42" inline: 90 s in the brand, a chapter per
  feature. Nobody wrote, cut or sent anything; each PM only ticked "Add to Friday".
- The PRD's feature PR merges, and its page already reads "Post the launch". One click, and the feature plays in
  colleagues' feed before anyone reads a word.

## Why this one

**Scores.** Round 3 scored the merged direction 1–5, as the median of 9 panelists: Wow 4 · Value 5 · Craft 4 · Fit 5 ·
Feasibility 3. In round 2, 8 of 9 panelists put "Ready on ship" first, and every one proposed folding the Friday edition
into it.

**Stances:**

- **Visionary:** the product is the moment "Post the launch" is already waiting. The Friday edition is the screenshot
  people forward.
- **Craft:** the most faithful build to the PRD page's own grammar. The Friday edition must stay plain, with no
  blueprint costume.
- **Skeptic:** the right default, with feasibility at 3. Three things are new and nothing does them today: an Omni Slack
  app (`chat:write`, `files:write`), rendering in CI, and the Friday scheduler. The smallest proof comes first: a
  rendered MP4 uploaded as a message in a test channel, to check that it plays inline.
- **Value:** the launch finally happens for every opted-in PRD, at one click. The three lines follow Thomas's structure,
  Limits included.
- **Personas:**
  - Paul - Product Manager: "the only one that costs me seconds, not a pass."
  - Irisa: approves once on her phone.
  - Lead Engineer: zero touch for the teams.
  - B-E DEv: respects it because it shows the real screen with a required Limits line.
  - F-E Developer: honest by default, with every line citing its source.

**Dissent, kept:**

- B-E DEv wanted the copy desk (round-2 direction 2) as the base, not the exception.
- The F-E Developer doubts the honesty of chapters drawn as mocks; the crowned rule is "after footage only, sourced
  words".
- Craft and the Skeptic warn that Slack may not autoplay an uploaded MP4 muted. Frame 0 is the headline card so that a
  still first frame still says what changed, but this must be proven before anything else.

## Killed and why

- **A · Written first** (script at brainstorm): too heavy per PRD. Kept only as the one-tap opt-in.
- **B · Click-through** (an interactive demo instead of a video): kept as a link in the post, not the launch itself.
- **C · The Trailer Cut** (a cinematic trailer with a poster): the costume was refused ("Vertuoza theme only"). Its
  beats live on in the Spotlight format.
- **D · The Wire** (an editorial desk, headline angles): its discipline survives (the Limits line, sourced claims, three
  lines). The desk as a page died with direction 2.
- **E · The Direct** (a weekly Nintendo-style show): the format was refused. It was reborn as the Friday Tech News.
- **F · The Drop** (a before/after wipe in the feed): the "before" was dropped as too hard and often absent. The inline
  video survives.
- **G · Script Cut** (edit a sentence and the clip re-cuts): too heavy. Replaced by prompt-to-adapt versions.
- **H · Asked-for** (tag the colleagues whose customers asked): no data source exists today (the User voice tab holds
  synthetic personas). Killed by the person: "we're working on it, maybe not in this flow."
- **Round 2 · direction 2 · The Launch Desk** (a scene strip editor): killed. Too much work per launch.
- **Round 2 · direction 3 · The Site Report**: merged into direction 1 as the Friday Tech News. The name collided with
  Vertuoza's worksite vocabulary.

## Fuel

**Product facts read:**

- `/omni:pitch` and `kit/lib/pitch` (storyboard, check, render, push, providers registry).
- `kit/pitch-engine` (Omni's own React scene engine, rendered in a headless browser, then ffmpeg; no Remotion).
- The per-product Pitch settings (`kit/lib/pitch/settings.ts`: look, voice preset and instructions, intro and outro,
  music, length) and the PRD page's Pitch and Proof tabs (`apps/galaxy/src/dossier/page/`).
- PRD 798 (proof video), PRD 859 (pitch), PRD 1108 (pitch studio) and PRD 262 (release notes).
- `notify.slack` in the config, which today posts only CI outbox notes. Nothing posts to Slack from the Omni page.
- The design form and the `prd-dossier` and `products` screens.
- Thomas Margraff's #release-won post of 2026-10-08.
- `vertuoza/release-videos`, Thomas Margraff's engine: storyboard JSON → Vertuoza-branded MP4 for Slack, music sync,
  last pushed 2026-09-30.

**References looked at:**

- [Screen Studio](https://www.screen.studio): auto-zoom from click positions.
- [Arcade](https://www.arcade.software/): brand kit plus product context, in a video.
- [Supademo](https://supademo.com/)
- [Loom AI](https://www.loom.com/ai)
- [Remotion](https://www.remotion.dev/): its company licence is noted.
- [Descript](https://www.descript.com/): edit the text, edit the video.
- [Linear changelog](https://linear.app/changelog)
- [Raycast changelog](https://www.raycast.com/changelog)
- [Vercel Ship](https://vercel.com/ship)
- [Slack Workflow Builder](https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder)
- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api): about $0.04–0.08 per minute.
- [Kokoro TTS](https://github.com/hexgrad/kokoro): Apache-2.0, includes French.
- [Pixabay licence](https://pixabay.com/service/license-summary/)
- [Typefully](https://typefully.com/)
- [Spotify Wrapped](https://en.wikipedia.org/wiki/Spotify_Wrapped)
- [Nintendo Direct](https://en.wikipedia.org/wiki/Nintendo_Direct)

**Slack constraints found:**

- A video upload is a three-call flow.
- Block buttons are ignored when `initial_comment` is set.
- Inline playback of an uploaded MP4 is not documented, so it must be tested.

**Business claims cited:** region#5

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| launch-post | Post inline to Slack | An Omni Slack app posts a PRD's rendered video as the message in #release-won (three-step upload, three lines with Limits and links), only on the PM's "Post the launch". No video means no post, and the PM gets the reason and Retry. Reuses the MP4 `/omni:pitch` already pushes, and proves inline playback first. | |
| launch-on-ship | Ready on ship | The one-toggle opt-in (Post when shipped / Add to Friday), "Waiting for prod", a CI render of the after footage in a fixed format (Flash, Feature, Spotlight, Still) from the Pitch settings, and Launch replacing the Pitch tab and the terminal run. Settles `vertuoza/release-videos` as the render provider versus porting its best parts. | |
| tech-news | Friday Tech News | The per-product Tech News page of the week's "Add to Friday" launches, each PM able to untick theirs. At 11:00 on Friday one group video posts itself inline (cover, a chapter per feature, outro, chapter times). It skips under two, and posts nothing if the group render fails. | |
| launch-adapt | Adapt by prompt | One prompt line plus chips rewrite the storyboard within its schema. The check refuses unsourced claims, a strip of changed stills shows the diff, and each adapt is a new version with "Use this version", Undo, and an upload of your own video. | |
| launch-from-scratch | New video from screenshots or a prompt | For a launch with nothing filmed, or no PRD: screenshots and/or a prompt go into the same storyboard, check, render and post, with words only from what was given plus the linked spec. | |
