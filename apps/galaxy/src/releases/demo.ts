// The demo sample of /releases (PRD 262): the rows the page shows in development, or in a build that
// asks for the demo (src/data/mode.ts), in place of public.releases.
//
// - The initial release is this repository's own: each shipped note pinned to 0.0.1, word for word,
//   dated when its shipped folder reached main (demo.test.ts holds it to the notes).
// - The releases after it are a sample, not a record: plausible notes written by the rules every
//   note follows, spread over five weeks so the page shows four open and folds the oldest.
import type { ReleaseRow } from './row.ts';

const initial = (prd: number, released_at: string, title: string, description: string): ReleaseRow =>
  ({ prd, release: 1, released_at, title, description });

export const DEMO_RELEASES: readonly ReleaseRow[] = [
  initial(3, '2026-09-25T13:17:33+00:00', 'Install the delivery loop in any repository',
    'The Omni Loop kit packages the brainstorm, build, review and ship loop as one command-line tool and one configuration folder, so any repository can run it without a hand-made copy of its own.'),
  initial(7, '2026-09-25T13:17:33+00:00', 'Brainstorm, build and ship with three commands',
    'The omni plugin for Claude Code gives the loop its commands: /omni:brainstorm turns an idea into a reviewed PRD, /omni:yolo builds it in parallel slices, and /omni:yolo-fix reworks what a reviewer disagreed with.'),
  initial(28, '2026-09-25T13:17:33+00:00', 'Every open question, visible on the pull request',
    'The omni-loop GitHub App adds an outbox check to every pull request. It stays red while a decision the agents took still waits for a person, so reviewers see open questions before they merge.'),
  initial(39, '2026-09-25T13:17:33+00:00', 'Set up Omni Loop with one line',
    'omni init installs the loop in a repository with a single command: it writes the configuration, adds the command-line tool, creates the labels the loop uses and says what is left to connect.'),
  initial(45, '2026-09-25T15:47:56+00:00', 'A playbook that tells agents how your repo works',
    'Each repository gets a playbook of short forms (how it tests, what a merge publishes, what must never break), filled from what the repository already documents. Agents read it at every step of the loop.'),
  initial(50, '2026-09-25T14:44:11+00:00', 'Decision reviews with a sense of humour',
    'Every question the agents leave for a person on a pull request now opens with a short intro and ends with a punchline, so a long list of decisions reads like a conversation rather than a form.'),
  initial(68, '2026-09-26T06:17:34+00:00', 'Your repository\'s rules, found and written down',
    '/omni:invade explores a repository and proposes its knowledge base: principles, business rules and invariants, pointing at the pages that already state them or drafted from what the code enforces.'),
  initial(71, '2026-09-26T05:45:59+00:00', 'Answer Claude on a page, not in a terminal',
    'Ask mode shows the questions Claude asks during a session on a clean web page, with options and previews side by side. It is switched on per checkout, and the terminal takes over whenever the page cannot answer.'),
  initial(72, '2026-09-26T06:44:14+00:00', 'Every delivery comes with its own retrospective',
    'When a PRD merges, the Omni Loop app counts what went wrong during its delivery and opens a retro pull request with findings, evidence and proposed lessons. It runs again 14 days later.'),
  initial(82, '2026-09-26T08:46:57+00:00', 'Every decision lands in the knowledge base',
    'When a PRD merges, the decisions taken while building it are sorted into the knowledge base as decision records, rules or invariants, with who answered and who merged. One pull request carries them all.'),
  initial(94, '2026-09-26T05:45:10+00:00', 'The arcade, in your pocket',
    'On a phone, the Omni Loop arcade appears as a handheld console with readable text and real buttons; on a computer, the screen alone fills the window. The game itself does not change.'),
  initial(99, '2026-09-26T06:43:52+00:00', 'Omni-man signs the loop\'s work',
    'Every commit, pull request and issue the loop makes carries Omni-man\'s signature, and a new command, omni credits, counts his contributions across the organisation.'),
  initial(100, '2026-09-26T14:41:45+00:00', 'One loop, many teams',
    'Everything the game holds now belongs to a workspace, with its own members, fleets, repositories and colours. Vertuoza is the first workspace, and others can join without seeing each other\'s data.'),
  initial(141, '2026-09-26T15:56:01+00:00', 'One look for everything Omni Loop',
    'A single design library holds the Omni Loop logo, colours, fonts and pixel sprites. The arcade and every reading page draw from it, and a catalogue page shows each piece.'),
  initial(142, '2026-09-26T15:12:38+00:00', 'Every terminal gets its own tab',
    'Ask mode keeps one session per Claude Code terminal. The page shows each terminal as a tab, so questions from sessions running side by side no longer overwrite each other.'),
  initial(144, '2026-09-27T08:03:01+00:00', 'No answer is ever lost again',
    'Every question Claude asks is kept for good, with its repository, branch, PRD, cost, category and who answered. The whole workspace can browse the history, and a live question can be shared with a teammate.'),
  initial(149, '2026-09-26T11:43:34+00:00', 'See your knowledge base as a galaxy',
    'Each domain of a repository\'s knowledge base appears as a star system of its principles, rules and invariants, in the arcade and on a plain reading page.'),
  initial(160, '2026-09-27T05:41:40+00:00', 'Shipping now levels you up',
    'Every point earned by delivering also counts as experience that never resets. Levels unlock games in a new game room, starting with Entropy Invaders at the very first point.'),
  initial(215, '2026-09-27T08:13:21+00:00', 'A signature that links back home',
    'Pull requests and issues made by the loop end with "Omni-man by Omni Loop ©", linking to the Omni Loop home page. The hero\'s name and the link are set once in the configuration.'),
  initial(216, '2026-09-27T13:29:53+00:00', 'Every PRD gets a home the whole team can read',
    'Each PRD\'s spec, plan and before/after page are kept on the Omni page with every version, next to the questions that shaped them, for the whole workspace to read.'),
  initial(238, '2026-09-27T11:21:00+00:00', 'Jump between work and play in one tap',
    'A Game mode button on every app page and an App mode switch in the arcade move you between the reading pages and the game, with a confirmation before each switch. The app gets its own home page.'),

  // The sample: what the page looks like once it has grown.
  {
    prd: 262, release: 2, released_at: '2026-09-28T09:12:00+00:00',
    title: 'Everything we ship, in plain words',
    description: 'Every PRD the loop ships now comes with a release note, reviewed with its code and published on a public page, week by week, with its own version number.',
  },
  {
    prd: 270, release: 3, released_at: '2026-09-29T14:05:00+00:00',
    title: 'Answer from your phone between two meetings',
    description: 'Ask mode\'s page fits a phone screen: the options stack, the previews fold away, and an answer goes back to the terminal in one tap.',
  },
  {
    prd: 284, release: 4, released_at: '2026-10-07T10:30:00+00:00',
    title: 'See which questions wait the longest',
    description: 'The question history sorts open questions by how long they have waited, so the oldest decision in the workspace is the first one a person sees.',
  },
  {
    prd: 291, release: 5, released_at: '2026-10-15T08:45:00+00:00',
    title: 'Every slice says where it stands',
    description: 'Each slice of a PRD keeps a short status on its pull request while it is built, so anyone can tell what is done, what is stuck and why, without reading the code.',
  },
  {
    prd: 305, release: 6, released_at: '2026-10-19T12:00:00+00:00',
    title: 'A weekly digest of what the loop decided',
    description: 'Every Monday, the workspace gets one summary of the decisions agents took the week before and who confirmed them, grouped by PRD.',
  },
  {
    prd: 318, release: 7, released_at: '2026-10-20T15:20:00+00:00',
    title: 'Knowledge you can search',
    description: 'The knowledge map gains a search box that finds a principle, a rule or an invariant by any word it holds, across every domain of the repository.',
  },
];
