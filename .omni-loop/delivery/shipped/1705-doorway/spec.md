---
prd: 1705
title: "The doorway: a focused arcade frame for the sign-in pages"
blocked-by: none
spec: file
phase0: server
---

# The doorway: a focused arcade frame for the sign-in pages

**Date:** 2026-10-12 · **PRD:** #1705 · **After:** PRD 1660 (`/ask/device`), PRD 71 (`/ask/signin`),
PRD 359 (`/signup`), PRD 438 (the app shell) · **Touches:** `apps/galaxy/app/ask/` (its layout split
into two route groups), `apps/galaxy/app/signup/layout.tsx`, a new `apps/galaxy/src/doorway/`, the
code panel in `apps/galaxy/src/ask/device-card.tsx`, `/signup`'s words in
`apps/galaxy/src/signup/SignupScreen.tsx`, and the screen library
(`.omni-loop/knowledge/design/screens/`). **Out of scope:** how anyone signs in: the device codes,
the polling, `/ask/callback`, `/auth/callback`, deny, kit tokens and `/signup`'s install logic are
unchanged; the words of `/ask/device` and `/ask/signin` stay as they are; the app shell itself.

## Problem

The pages a person sees *before* they are inside the app wear the app's frame. `/ask/device`
(`omni signin` by code) and `/ask/signin` (`omni signin` by browser) sit under
`apps/galaxy/app/ask/layout.tsx`, which wraps every `/ask` page in `<AppShell>`: the sidebar with
the whole Dashboard and Work menus, the top bar reading `Work › Questions`, Questions marked as the
current page, the theme switch, Game mode, the bell and the avatar. Seen on 2026-10-12 after an
`omni signin --device`: the "Back to your terminal" card sat in the corner of a page that looked
like the Questions inbox.

A sign-in is a doorway, not a page of the app: someone arriving from a terminal link has one thing
to do — check a code, press one button — and the frame around it should hold that one thing, as
GitHub's and Claude's device pages do. The screen library already says so: `ask-device` describes
"the wordmark above the card, as on `/ask/signin`", with no shell. The code drifted from it.
`/signup` already stands outside the shell, but as a bare reading column with no mark of the
product at all: three doorways, three looks.

## Solution

### One frame, three doorways

A shared **doorway** frame, `apps/galaxy/src/doorway/Doorway.tsx` with `doorway.css`, for the three
pages a person meets before the app: `/ask/device`, `/ask/signin` and `/signup` (with
`/signup/installed`'s screens, which render through `/signup`). No URL changes.

- **No app shell:** no sidebar, no top bar, no theme switch, no Game mode, no bell, no avatar.
- **The ground:** Ask's `ground` token for the stored theme, filling the viewport. Under Omni and
  Dark, the starfield HOME already draws (`starfieldSvg()` in `apps/galaxy/src/home/poster/art.ts`)
  lies behind everything: static, server-rendered SVG, `aria-hidden`, nothing that moves. Under Light
  the ground stays plain.
- **The mark,** centred above the card: the crest's full form, the crest beside the `OMNI LOOP`
  lettering, drawn in pixels (`logoSvg(CREST_FORM, { scale: 3 })` from `@omni/design`, the form HOME's
  poster uses), 366×54 at 3×. It carries its accessible name (`OMNI LOOP`) and links to `/`.
- **The card:** the existing `ask-card`, unchanged in face and tokens: the reading face at 17 px,
  `surface` on `ground`, its edge `lineStrong`. One column, at most 460 px wide.
- **The code,** on `/ask/device` only: the user code (`8M5T-2LFF`) moves from the mono face into the
  pixel face (`--font-pixel`, Press Start 2P, at 24 px: three times its 8 px grid, a whole-number
  scale like every pixel drawing; 16 px, the `pixel-l` step, below 900 px), on the `sunk` panel it already has, like the
  arcade's INSERT COIN line. It is the one arcade touch inside a card. The code box on the Enter the
  code state keeps the mono face: a person types in it.
- **Under the card,** one quiet line in `muted`: a `Docs` link to `/docs`. Nothing else.
- **Below 900 px:** the card spans the width less a 16 px gutter on each side, and the crest drops
  to 2×. The page never scrolls sideways.
- **Themes:** the stored theme still applies, through the theme script as the first child of the
  root, as `/signup` does today. With no switch on the page, a person changes theme from inside the
  app.

### `/signup`'s words, cut to the word pass

The word pass (`omni design words`) finds two sentences on today's install card past its 7 words at
rest: a 56-word paragraph and an 8-word tail. Each `/signup` screen keeps what a person must know to
press its button; what it explained moves to the docs, which already say it
(`/docs/install#install-the-github-app`). In `SignupScreen.tsx`:

| screen | today | after |
|---|---|---|
| install | the paragraph `Omni Loop works on your GitHub org's repositories. Install it on the org, and pick … a workspace of your own.` | `Pick the repositories it may read.` · the install button · `Not the owner? GitHub asks them.` · `Already in a workspace?` **Sign in again** · a link **How sign-up works** to `/docs/install#install-the-github-app` |
| install, the tail | `Your org uses Omni Loop already? Sign in again: you join its workspace, with nothing to install.` | (folded into `Already in a workspace?` **Sign in again**) |
| waiting | `You asked for Omni Loop on <orgs>. Only an owner of the org can install it. Once they have approved it on GitHub, sign in again: you land in its workspace.` | `Only an org owner can install it.` · `Once approved, sign in again.` |
| error `link` | `Start from the install button below: once Omni Loop is installed, GitHub sends you back here with it.` | `Start from the install button below.` |
| error `github` | `Omni Loop could not check the installation with GitHub, so nothing was created. Try again in a moment.` | `Nothing was created. Try again shortly.` |
| error `unknown` | `Nothing was created. Install Omni Loop from the button below, and GitHub sends you back with the right one.` | `Nothing was created. Install from the button below.` |
| error `not-yours` | `Omni Loop is installed on a GitHub account you neither are nor belong to, so nothing was created. Install it on your own account, or on an org you belong to.` | `Nothing was created. Install it on your account or org.` |
| error `no-org` | title `No org of yours is waiting for Omni Loop`; `Every GitHub org you belong to has Omni Loop already, or you belong to none. Sign in again to join their workspaces, or install Omni Loop on your own account.` | title `No org of yours is waiting`; `Sign in again to join their workspaces.` |
| no GitHub App | `This deployment has no GitHub App set up: sign-up is not open here.` | `Sign-up is not open here.` |

Titles, buttons, links, reasons and the `waiting` titles (`Waiting for <org>'s owner`) are otherwise
unchanged.

### Where it is mounted

- `apps/galaxy/app/ask/layout.tsx` keeps what every `/ask` page shares: the stylesheets, the
  metadata and the viewport. It stops rendering `<AppShell>`.
- A new route group `apps/galaxy/app/ask/(shell)/layout.tsx` renders `<AppShell viewer={…}>`, and
  holds `page.tsx`, `for-me/`, `history/`, `q/` and `[session]/`, moved there unchanged.
- A new route group `apps/galaxy/app/ask/(doorway)/layout.tsx` renders `<Doorway>`, and holds
  `signin/` and `device/`, moved there unchanged. `callback/` (a route, no page) stays where it is.
- `apps/galaxy/app/signup/layout.tsx` renders `<Doorway>` in place of its bare `<main>`.
- `Doorway` takes its children and renders the root `.ask` element, the theme tokens (`themeCss()`),
  the theme script, the starfield, the mark and a `<main>` holding the children. It reads no session
  and no viewer: a doorway is shown to someone who may not be signed in.

### The screen library

- A new shared draft screen, `doorway` (`kind: shared`, `routes: [/ask/device, /ask/signin,
  /signup]`), with its mockup.
- `ask-device` (a draft) brought up to the after: the frame named, the code in the pixel face.
- New draft screens `ask-signin` and `signup`, each a page inside the doorway.
- `app-shell` (a draft): its `reads` and `Purpose` say `/ask/signin` and `/ask/device` are outside
  it, mounted by the doorway group.

## Decisions

- **The doorway is not an app page.** The design form's *Deliberate* section says "the app pages are
  a reading surface, not the arcade" and keeps the pixel face to the header wordmark. The three
  doorway pages are classed as doorways, not app pages: the pixel face appears in the wordmark and
  the device code only, the starfield is the ground, and every sentence stays in the reading face
  on Ask's tokens. Asked and answered by the person who brought the idea ("arcade frame, readable
  card"). Recorded so `kb show design` can gain a line for it once shipped.
- **Light has no stars.** Pixel stars on Light's near-white ground read as dust, and no star colour
  of the palette is tested on it. Light shows the plain ground. Reversible: one rule in
  `doorway.css`.
- **No theme switch on a doorway.** The doorway is the moment before the app; the stored theme still
  applies, and the switch lives inside the app.
- **`/signup` joins the doorway** (asked: "all doorways"). Its screens and its install link are
  unchanged.
- **`/signup`'s words are cut to pass the word pass** (asked, once the word pass flagged today's
  install card: "rewrite to pass"). What the cut sentences explained is already in
  `/docs/install#install-the-github-app`, which the install card now links. Reversible: the words
  live in one file.
- **Route groups, not a per-page opt-out.** Moving the shell into `ask/(shell)/` keeps the rule in the
  file tree, where a new `/ask` page lands in the shell unless it is put in the doorway on purpose.
- **The persona's objection,** shown with the design: *B-E Dev* (`persona:B-E DEv`): "A starfield on a
  sign-in page is exactly the fluff I expect from this tool. I only want to see the code match and
  get back to my terminal." Settled `none`: the person approved the design without answering it.
  What the design already does for it: the stars are static, and the code is the largest thing on
  the page.
- **No proof video** (asked: no).

## User stories

- As a person who ran `omni signin` in a cloud session, I open the link and see only the code and
  one button, so I know at once what to check and what to press.
- As a person signing a terminal in by browser, I see the same doorway, so both sign-ins feel like
  one product.
- As a visitor installing Omni Loop from `/signup`, I meet the product's mark and its starfield, not
  a bare column, and read one line before the button, not a paragraph.
- As a member already inside the app, every other `/ask` page keeps its sidebar and top bar.

## Scope

**In:** the doorway frame and its stylesheet; the `ask/` route groups; `/signup`'s layout and its
words (the table above); the device code's face; the four screen-library drafts and the `app-shell` draft's correction; the tests below.

**Out:** any change to sign-in, tokens, polling, callbacks or install; any word change on
`/ask/device` or `/ask/signin`; a theme switch
on the doorway; motion of any kind; `/ask/callback`; the arcade's own sign-in (`/play`'s join scenes).

## Test seams

Tests sit beside the code under `apps/galaxy/src/`, run by `pnpm test`, and never call GitHub or
Supabase (`kb show testing`).

- **`apps/galaxy/src/doorway/Doorway.render.test.ts`** renders `Doorway` to static markup: it holds
  the `.ask` root, the theme script as its first child, the mark (the crest's full form, named
  `OMNI LOOP`, linked to `/`), the starfield marked `aria-hidden`, the children inside `<main>`, the `Docs` link,
  and no element of the app shell (no sidebar, no app bar, no theme switch).
- **`apps/galaxy/src/doorway/routes.test.ts`** reads the `app/ask` tree: `signin/` and `device/` sit
  under `(doorway)/`; `page.tsx`, `for-me/`, `history/`, `q/` and `[session]/` under `(shell)/`;
  `(shell)/layout.tsx` renders `AppShell` and `(doorway)/layout.tsx` renders `Doorway`;
  `app/ask/layout.tsx` renders neither.
- **`apps/galaxy/src/signup/layout.test.ts`** renders `app/signup/layout.tsx`: it holds the doorway
  and no app shell.
- **`apps/galaxy/src/ask/theme-color.test.ts`** keeps passing for `/ask`; `/signup`'s viewport keeps
  Omni's ground.
- **`apps/galaxy/src/signup/SignupScreen.test.ts`** holds each screen's new words (the table above),
  the **How sign-up works** link's address, and no sentence of the old ones.
- **The word pass:** `node .omni-loop/bin/omni.mjs design words` over the `signup` and `ask-device`
  library mockups finds nothing.
- **The device card's test** (beside `device-card.tsx`): the confirm state renders the code in an
  element carrying the pixel face's class; the enter-the-code box does not.
- **Tests that follow the move:** `ask/page/questions-pages.test.ts` (imports `app/ask/for-me/` and
  `history/`), `ask/page/share-render.test.ts` and `switch/headers.test.ts` (read `app/ask/layout.tsx`
  as the shell's layout) point at `app/ask/(shell)/` after the move, and still hold what they hold.
- **Guards that must stay green:** `design-system.test.ts` (no colour on `:root`, no Google Fonts),
  `page-width.test.ts`, `theme-tokens.test.ts`.
- **By eye:** `pnpm galaxy:shots` with `pnpm galaxy:dev` running, the three pages at 393×700,
  852×393 and 1440×900, in Omni, Light and Dark.

## Risks

- **What merging publishes:** the galaxy deploys on merge to `main` (`kb show releasing`). Every
  visitor to the three doorway pages sees the new frame at once. **Rollback:** revert the feature
  PR's merge commit; the route groups move back with it, and no data is touched.
- **A route-group move breaks a route.** Moving folders under `app/ask/` changes no URL by Next.js's
  rules, but a stray relative import breaks the build. The build, the typecheck and the route test
  catch it before merge.
- **A shell page lands in the doorway, or the reverse.** The route test names each folder.
- **The starfield weighs on a phone.** It is one SVG HOME already serves, cached in memory after the
  first draw (`starfieldSvg()`); the shots at 393×700 show it.

## Acceptance criteria

- Opening `/ask/device?user_code=<code>` shows no sidebar, no top bar and no theme switch: the crest
  and its `OMNI LOOP` lettering above one card, the code in the pixel face, **Yes, sign it in** and *No, it's not
  mine*.
- Every state of `/ask/device` (confirm, sign in, enter the code, done, denied, expired) renders
  inside the doorway, with today's words.
- `/ask/signin` (sign-in, token, and its not-open notice) renders inside the doorway, with today's
  words.
- `/signup` (install, waiting, each error, no GitHub App) renders inside the doorway, with the words
  of the table in **`/signup`'s words**, and its install card links **How sign-up works** to
  `/docs/install#install-the-github-app`.
- `/ask`, `/ask/for-me`, `/ask/history`, `/ask/q/<id>` and a shared `/ask/<session>` still show the
  app shell, as today.
- Under Omni and Dark the doorway's ground shows the starfield; under Light it does not.
- At 393 px wide, no doorway page scrolls sideways and the card keeps a 16 px gutter.
- No URL changes, and signing in by code, by browser and installing from `/signup` work as before.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass, `design-system.test.ts` among them.
