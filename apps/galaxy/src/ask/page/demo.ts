// The ask page without a database (`pnpm galaxy:dev`, or a build with OMNI_LOOP_DEMO=1, like the
// arcade's demo galaxy): one made-up session played in the browser, so the page can be seen and
// tried. `?demo=working|moved|closed|empty` shows the other states. Nothing here is ever sent.
import type { AskPort } from './source';
import type { RoundRow, SessionState } from './view';

export type DemoScenario = 'open' | 'working' | 'moved' | 'closed' | 'empty';
const SCENARIOS: DemoScenario[] = ['open', 'working', 'moved', 'closed', 'empty'];

export const readScenario = (value: unknown): DemoScenario => (SCENARIOS.includes(value as DemoScenario) ? (value as DemoScenario) : 'open');

const MIN = 60_000;

const MODE = {
  question: 'How should the questions reach the page?',
  header: 'Mode',
  multiSelect: false,
  options: [
    { label: 'Hook mode + nudge (Recommended)', description: 'A PreToolUse hook sends every AskUserQuestion; one line of context asks for the tool.' },
    { label: 'An instruction to the model', description: 'Each skill is told to call a tool of its own.' },
  ],
};
const HOST = {
  question: 'Where should the page live?',
  header: 'Host',
  multiSelect: false,
  options: [
    { label: 'The galaxy app', description: 'It already has the crew\'s Google sign-in.' },
    { label: 'A project of its own', description: 'One more deployment to keep.' },
  ],
};
const ACCESS = {
  question: 'How should the page and the agent be authenticated?',
  header: 'Access',
  multiSelect: false,
  options: [
    {
      label: 'Google sign-in through the galaxy (Recommended)',
      description: 'The CLI signs in once per machine; the page asks for the same @vertuoza.com account.',
      preview: 'omni signin\n  → opens <ask.url>/ask/signin\n  ← signed in as ada@vertuoza.com\n\n~/.config/omni/credentials.json  (0600)\n{\n  "galaxy.example": {\n    "access_token": "…",\n    "refresh_token": "…"\n  }\n}',
    },
    {
      label: 'gh token + secret link',
      description: 'The agent sends the gh token; the link carries a secret. No sign-in on the page.',
      preview: 'POST /api/ask/sessions\nAuthorization: token gho_…\n\n→ { "url": "https://…/ask/7c1e…?k=s3cr3t" }',
    },
    { label: 'Shared API key', description: 'One key everyone sets locally. Simplest, but a secret to rotate.' },
  ],
};
const CHECKS = {
  question: 'Which checks should gate the slice?',
  header: 'Checks',
  multiSelect: true,
  options: [
    { label: 'Row-level security', description: 'Two accounts\' tokens against the migration.' },
    { label: 'Handler tests', description: 'The API as functions, with a stubbed client.' },
    { label: 'A live session', description: 'A real Claude Code session answered from the page.' },
  ],
};
const LATER = [
  [{
    question: 'Should the page poll, or listen for changes?',
    header: 'Updates',
    multiSelect: false,
    options: [
      { label: 'Poll every 2 s (Recommended)', description: 'No new service; cheap at the crew\'s volume.' },
      { label: 'Supabase Realtime', description: 'Instant, but one more moving part.' },
    ],
  }],
  [{
    question: 'Which theme should a first visit get?',
    header: 'Theme',
    multiSelect: false,
    options: [
      { label: 'The system\'s (Recommended)', description: 'Light or dark, as the device is set.' },
      { label: 'Always dark', description: 'Like the arcade.' },
    ],
  }],
];

const iso = (at: number) => new Date(at).toISOString();

/** The demo session's owner: whoever plays the demo is them. */
export const DEMO_OWNER = 'demo';

/** The demo workspace's members (PRD 144): its owner, and two teammates to share a question with. */
export const DEMO_MEMBERS = [
  { user_id: DEMO_OWNER, email: 'ada@vertuoza.com', name: 'ADA' },
  { user_id: 'demo-po', email: 'paula@vertuoza.com', name: 'PAULA' },
  { user_id: 'demo-ux', email: 'uma@vertuoza.com', name: null },
];

export function demoState(id: string, scenario: DemoScenario, now: number): SessionState {
  const round = (n: number, questions: unknown[], ago: number, rest: Partial<RoundRow> = {}): RoundRow => ({
    id: `demo-round-${n}`,
    questions,
    answers: null,
    answered_via: null,
    status: 'open',
    created_at: iso(now - ago),
    answered_at: null,
    // Its context line (PRD 144), as a kit that reads it sends it.
    prd: 71,
    skill: '/omni:brainstorm',
    model: 'claude-opus-4-8',
    tokens: { input: 4_200 * n, output: 1_800 * n, cacheRead: 180_000 * n, cacheWrite: 24_000 * n },
    cost_usd: 0.26 * n,
    ...rest,
  });
  // Their categories (PRD 144): one the model sorted, one the owner set, and the open one unsorted.
  const answered = [
    round(1, [MODE], 14 * MIN, {
      status: 'answered', answered_via: 'page', answers: { [MODE.question]: MODE.options[0].label }, answered_at: iso(now - 13 * MIN),
      category: 'architecture', category_by: 'model',
    }),
    round(2, [HOST], 8 * MIN, {
      status: 'answered', answered_via: 'terminal', answers: { [HOST.question]: HOST.options[0].label }, answered_at: iso(now - 7 * MIN),
      category: 'product', category_by: DEMO_OWNER,
    }),
  ];
  const current = round(3, [ACCESS, CHECKS], MIN, scenario === 'moved' ? { status: 'abandoned' } : {});
  const rounds = scenario === 'empty' ? [] : scenario === 'working' ? answered : [...answered, current];
  return {
    session: {
      id,
      owner: DEMO_OWNER,
      title: 'vertuo-omni-loop · feat/ask-mode',
      status: scenario === 'closed' ? 'closed' : 'open',
      created_at: iso(now - 20 * MIN),
      last_seen_at: iso(now - 30_000),
      repo: 'vertuoza/vertuo-omni-loop',
      branch: 'feat/ask-mode',
    },
    rounds,
  };
}

/** The demo session in the browser: an answer is taken, and a moment later Claude asks again. */
export function demoPort(seed: SessionState, now: () => number = Date.now, askAgainMs = 4000): AskPort {
  let state: SessionState = structuredClone(seed);
  let asked = 0;
  let askAt: number | null = null;
  return {
    async read() {
      if (askAt !== null && now() >= askAt && asked < LATER.length) {
        const questions = LATER[asked];
        asked += 1;
        askAt = null;
        state.rounds.push({ id: `demo-round-${3 + asked}`, questions, answers: null, answered_via: null, status: 'open', created_at: iso(now()), answered_at: null });
      }
      if (state.session.status === 'open') state = { ...state, session: { ...state.session, last_seen_at: iso(now()) } };
      return structuredClone(state);
    },
    async send(roundId, answers) {
      const round = state.rounds.find((r) => r.id === roundId);
      if (!round || round.status !== 'open') return 'taken';
      Object.assign(round, { status: 'answered', answers, answered_via: 'page', answered_at: iso(now()) });
      askAt = now() + askAgainMs;
      return 'answered';
    },
    async remove() {
      state = { ...state, rounds: [] };
      return true;
    },
    async share(roundId, member) {
      return state.rounds.some((r) => r.id === roundId) && DEMO_MEMBERS.some((m) => m.user_id === member && m.user_id !== DEMO_OWNER);
    },
    async sort(roundId, category) {
      const round = state.rounds.find((r) => r.id === roundId);
      if (!round) return null;
      Object.assign(round, { category, category_by: DEMO_OWNER });
      return { category, category_by: DEMO_OWNER };
    },
  };
}
