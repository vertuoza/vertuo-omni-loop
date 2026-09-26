// The ask page without a database (`pnpm galaxy:dev`, or a build with OMNI_LOOP_DEMO=1, like the
// arcade's demo galaxy): three made-up terminals, one of them asking, played in the browser, so the
// page can be seen and tried. `?demo=working|moved|closed|empty` shows the other states on the
// first one. Nothing here is ever sent.
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

export function demoState(id: string, scenario: DemoScenario, now: number): SessionState {
  const round = (n: number, questions: unknown[], ago: number, rest: Partial<RoundRow> = {}): RoundRow => ({
    id: `demo-round-${n}`,
    questions,
    answers: null,
    answered_via: null,
    status: 'open',
    created_at: iso(now - ago),
    answered_at: null,
    ...rest,
  });
  const answered = [
    round(1, [MODE], 14 * MIN, { status: 'answered', answered_via: 'page', answers: { [MODE.question]: MODE.options[0].label }, answered_at: iso(now - 13 * MIN) }),
    round(2, [HOST], 8 * MIN, { status: 'answered', answered_via: 'terminal', answers: { [HOST.question]: HOST.options[0].label }, answered_at: iso(now - 7 * MIN) }),
  ];
  const current = round(3, [ACCESS, CHECKS], MIN, scenario === 'moved' ? { status: 'abandoned' } : {});
  const rounds = scenario === 'empty' ? [] : scenario === 'working' ? answered : [...answered, current];
  return {
    session: {
      id,
      owner: 'demo',
      title: 'vertuo-omni-loop · feat/ask-mode',
      status: scenario === 'closed' ? 'closed' : 'open',
      created_at: iso(now - 20 * MIN),
      last_seen_at: iso(now - 30_000),
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
    session: { id: `demo-terminal-${n}`, owner: 'demo', title, status: 'open', created_at: iso(now - 90 * MIN), last_seen_at: iso(now - ago) },
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
  };
}
