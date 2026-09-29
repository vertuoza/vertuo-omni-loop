// The ask page without a database (`pnpm galaxy:dev`, or a build with OMNI_LOOP_DEMO=1, like the
// arcade's demo galaxy): three made-up terminals, one of them asking, played in the browser, so the
// page can be seen and tried. `?demo=working|moved|closed|empty` shows the other states on the
// first one. Nothing here is ever sent.
import type { QuestionState } from './question';
import type { AskPort, QuestionPort } from './source';
import type { RoundRow, SessionRow, SessionState } from './view';
import type { HistoryRow } from './workspace-history';

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

const DEPLOY = {
  question: 'Which preview should the live proof run against?',
  header: 'Preview',
  multiSelect: false,
  options: [
    { label: 'The feature branch\'s (Recommended)', description: 'Every slice merged, nothing on main yet.' },
    { label: 'Production', description: 'Only once the feature PR merges.' },
  ],
};
const QUOTES = {
  question: 'Should a quote keep its lines when it is copied?',
  header: 'Quotes',
  multiSelect: false,
  options: [
    { label: 'Yes, every line (Recommended)', description: 'The copy starts as the original.' },
    { label: 'Only the header', description: 'The lines start empty.' },
  ],
};

/** The terminals the demo plays on /ask: the first one asks (or shows `scenario`), the two others
 * are working, one on another branch of the same repository and one in another repository. */
export function demoSessions(scenario: DemoScenario, now: number): SessionState[] {
  const first = demoState('demo-terminal-1', scenario, now);
  const quiet = (n: number, title: string, question: typeof DEPLOY, ago: number): SessionState => ({
    session: { id: `demo-terminal-${n}`, owner: DEMO_OWNER, title, status: 'open', created_at: iso(now - 90 * MIN), last_seen_at: iso(now - ago) },
    rounds: [{
      id: `demo-terminal-${n}-round-1`,
      questions: [question],
      answers: { [question.question]: question.options[0].label },
      answered_via: 'page',
      status: 'answered',
      created_at: iso(now - ago - 3 * MIN),
      answered_at: iso(now - ago - 2 * MIN),
    }],
  });
  return [
    first,
    quiet(2, 'vertuo-omni-loop · main', DEPLOY, 2 * MIN),
    quiet(3, 'vertuo-workflow-domain · feat/copy-quote', QUOTES, 6 * MIN),
  ];
}

/** The session a demo pane plays: one of the terminals, or, for any other link (a PRD 71 one), the
 * single session it always played. */
export function demoPane(id: string, scenario: DemoScenario, now: number): SessionState {
  return demoSessions(scenario, now).find((s) => s.session.id === id) ?? demoState(id, scenario, now);
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

/** The demo workspace's history (PRD 144): the demo session's rounds, and a teammate's session on
 * another repository whose business question the owner answered. */
export function demoHistory(now: number): HistoryRow[] {
  const { session, rounds } = demoState('demo', 'open', now);
  const TRIAL = {
    question: 'How long should the free trial last?', header: 'Trial', multiSelect: false,
    options: [{ label: '14 days', description: '' }, { label: '30 days', description: '' }],
  };
  const pricing: SessionRow = {
    id: 'demo-pricing', owner: DEMO_MEMBERS[1].user_id, title: 'vertuo-app · feat/pricing', status: 'closed',
    created_at: iso(now - 3 * 24 * 60 * MIN), last_seen_at: iso(now - 3 * 24 * 60 * MIN + 30 * MIN), repo: 'vertuoza/vertuo-app', branch: 'feat/pricing',
  };
  const trial: RoundRow = {
    id: 'demo-round-trial', questions: [TRIAL], answers: { [TRIAL.question]: '14 days' }, answered_via: 'page', status: 'answered',
    created_at: iso(now - 3 * 24 * 60 * MIN + 10 * MIN), answered_at: iso(now - 3 * 24 * 60 * MIN + 14 * MIN), answered_by: DEMO_OWNER,
    prd: 94, skill: '/omni:yolo', model: 'claude-sonnet-4-6', category: 'business', category_by: 'model',
    attachments: { [TRIAL.question]: ['demo-round-trial/1.png', 'demo-round-trial/2.png'] },
  };
  // The page answer came from the teammate it was shared with; the terminal's is the owner's.
  const answeredBy = (round: RoundRow) => (round.status !== 'answered' ? null : round.answered_via === 'terminal' ? DEMO_OWNER : DEMO_MEMBERS[1].user_id);
  return [...rounds.map((round) => ({ round: { ...round, answered_by: answeredBy(round) }, session })), { round: trial, session: pricing }];
}

/** The teammate the demo's open question is shared with: whoever plays /ask/q/demo is them. */
export const DEMO_TEAMMATE = DEMO_MEMBERS[1].user_id;

/** The demo's shared question (PRD 144): its open round, shared with the teammate, or (`answered`)
 * already answered by the owner in the terminal. */
export function demoQuestion(now: number, answered = false): QuestionState {
  const { session, rounds } = demoState('demo', 'open', now);
  const open = rounds[rounds.length - 1];
  const answers = Object.fromEntries((open.questions as Array<{ question: string; options: Array<{ label: string }> }>).map((q) => [q.question, q.options[0].label]));
  const round = answered
    ? { ...open, status: 'answered' as const, answers, answered_via: 'terminal' as const, answered_at: iso(now - 20_000), answered_by: DEMO_OWNER }
    : open;
  return { session, round, earlier: rounds.slice(0, -1), sharedWith: [DEMO_TEAMMATE] };
}

/** The demo's shared question in the browser: the teammate's answer is taken, once. */
export function demoQuestionPort(seed: QuestionState, now: () => number = Date.now): QuestionPort {
  let state: QuestionState = structuredClone(seed);
  return {
    async read() {
      return structuredClone(state);
    },
    async send(roundId, answers) {
      if (state.round.id !== roundId || state.round.status !== 'open') return 'taken';
      state = { ...state, round: { ...state.round, status: 'answered', answers, answered_via: 'page', answered_at: iso(now()), answered_by: DEMO_TEAMMATE } };
      return 'answered';
    },
    async sort(roundId, category) {
      if (state.round.id !== roundId) return null;
      state = { ...state, round: { ...state.round, category, category_by: DEMO_TEAMMATE } };
      return { category, category_by: DEMO_TEAMMATE };
    },
  };
}
