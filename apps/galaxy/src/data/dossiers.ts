// The planets' dossiers (PRD 216), for the planet's DOSSIER tab, read as the signed-in member in the
// workspace the arcade plays, on their own after the galaxy, as XP and the high scores are: a read that
// fails leaves the galaxy shown, and the tab says DOSSIERS OUT OF REACH.
//
// A planet's dossier is the one whose home repository is the workspace's plan repository
// (`<github_org>/<plan_repo>`, in lower case, as the dossier keeps it) and whose number is the planet's
// PRD. The workspace row gives the plan repository, the dossiers table the ids of its PRDs' dossiers,
// and each of the galaxy's planets that has one is then read by its id: dossier_list(p_dossier) for its
// latest version of each kind and its question counts (supabase/migrations/20260928110000_dossier_list.sql),
// dossier_rounds(p_dossier) for its last three answered rounds (…100000_dossier_rounds.sql). Both
// compute a dossier's rounds, so neither is ever asked for every dossier at once. All of it runs as the
// member, so row-level security and PRD 144's access rules decide what comes back.
//
// The demo galaxy and the single-file artifact have no database: they get demo dossiers for a few of the
// demo world's planets (`demoDossiers`), shaped by the same function, and in the artifact, which has no
// page to open, no link.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { readQuestions, shownLabel } from '../ask/answer-model';
import { dossierPath } from '../dossier/page/view';
import { ARTIFACT_KINDS, dossierList, dossierRounds, PUSH_KINDS, PUSHED_ARTIFACT_KINDS, WORK_KINDS, type DossierKind, type DossierListRow, type DossierRoundRow } from '../dossier/store';
import type { DossierAnswer, DossierLatest, DossiersRead, PlanetDossier, PlanetDossierRead } from '../arcade/types';
import { z } from 'zod';
import { type PrdNumber, PrdNumberSchema, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { orThrow, parseRows } from './parse-rows';
import { listOf, numberOf } from './unparsed';

/** How many answered rounds the tab lists. */
export const LAST_ANSWERS = 3;

/** An artifact's latest version, as dossier_list() builds it in its `latest` JSON column. */
const LatestVersionEntry = z.strictObject({
  id: z.string(),
  version: z.coerce.number(),
  source: z.enum(['kit', 'github']),
  created_at: z.string(),
});

/** The fields of a row of dossier_list() whatever its kind. */
const LIST_SHAPE = {
  id: z.string(),
  workspace_id: z.string(),
  home_repo: z.string(),
  prd: PrdNumberSchema.nullable(),
  title: z.string(),
  opened_by: z.string().nullable(),
  created_at: z.string(),
  numbered_at: z.string().nullable(),
  repos: z.array(z.string()),
  asked: z.coerce.number(),
  answered: z.coerce.number(),
  last_activity: z.string(),
};

/** A row of dossier_list(), as the dossier layer's DossierListRow names it (supabase/migrations/
 * 20261011090000_fix_dossiers.sql). Its counts and versions are read as numbers on purpose. */
export const DossierListEntry: z.ZodType<DossierListRow> = z.strictObject({
  ...LIST_SHAPE,
  kind: z.enum(WORK_KINDS).optional(),
  latest: z.partialRecord(z.enum(ARTIFACT_KINDS), LatestVersionEntry),
});

/** Any row dossier_list() returns: since PRD 1272 (supabase/migrations/20261119090000_concept_dossiers.sql)
 * a concept's too, with its own version kinds. Read so that a concept never breaks the read of the rest. */
const AnyListEntry = z.strictObject({
  ...LIST_SHAPE,
  kind: z.enum(PUSH_KINDS).optional(),
  latest: z.partialRecord(z.enum(PUSHED_ARTIFACT_KINDS), LatestVersionEntry),
});

/** A round's first question with its answer, as one line of the tab; null when it has no answer to show. */
function answerOf(row: DossierRoundRow): DossierAnswer | null {
  const answers = row.answers ?? {};
  const asked = readQuestions(row.questions).map((q) => q.question);
  // An answer to a question the round does not name (an older kit's) is still an answer.
  const questions = [...asked, ...Object.keys(answers).filter((q) => !asked.includes(q))];
  const first = questions.find((q) => typeof answers[q] === 'string');
  const answer = first === undefined ? undefined : answers[first];
  if (first === undefined || typeof answer !== 'string' || !row.answered_at) return null;
  const more = questions.filter((q) => q !== first && typeof answers[q] === 'string').length;
  return { question: first, answer: shownLabel(answer).text, more, at: row.answered_at };
}

/**
 * A dossier as its planet's tab summarises it: from its dossier_list() row, each artifact's latest
 * version (null for one with none yet) and its rounds asked and answered; from its rounds, the last three
 * answered, newest answer first. `url` is the page START opens, or null where there is none.
 */
export function planetDossier(row: DossierListRow, rounds: DossierRoundRow[], url: string | null): PlanetDossier {
  const latestOf = (kind: DossierKind): DossierLatest | null => {
    const v = row.latest[kind];
    return v ? { version: numberOf(v.version), at: v.created_at } : null;
  };
  const latest: PlanetDossier['latest'] = { 'before-after': latestOf('before-after'), spec: latestOf('spec'), plan: latestOf('plan') };
  const last = rounds
    .flatMap((r) => (r.status === 'answered' && r.answered_at ? [{ round: r, answeredAt: r.answered_at }] : []))
    .sort((a, b) => Date.parse(b.answeredAt) - Date.parse(a.answeredAt) || b.round.round_id.localeCompare(a.round.round_id))
    .map(({ round }) => round)
    .map(answerOf)
    .filter((a): a is DossierAnswer => a !== null)
    .slice(0, LAST_ANSWERS);
  return { id: row.id, url, latest, asked: numberOf(row.asked), answered: numberOf(row.answered), last };
}

type Db = Pick<SupabaseClient<Database>, 'from' | 'rpc'>;

/** The workspace's plan repository as a dossier's home repository, or null when it has none. */
async function planRepo(db: Db, workspace: string): Promise<string | null> {
  const { data, error } = await db.from('workspaces').select('github_org, plan_repo').eq('id', workspace).maybeSingle();
  if (error) throw new Error(`Supabase: could not read the workspace's plan repository (${error.message})`);
  const row = data;
  return row?.github_org && row.plan_repo ? `${row.github_org}/${row.plan_repo}`.toLowerCase() : null;
}

/** The ids of the plan repository's PRDs' dossiers, by PRD number. */
async function dossierIds(db: Db, workspace: string, home: string): Promise<Map<number, string>> {
  const { data, error } = await db.from('dossiers').select('id, prd').eq('workspace_id', workspace).eq('home_repo', home);
  if (error) throw new Error(`Supabase: could not read the dossiers (${error.message})`);
  const ids = new Map<number, string>();
  for (const row of listOf(data)) if (row.prd !== null) ids.set(numberOf(row.prd), row.id);
  return ids;
}

/** One planet's dossier, or null when it is gone; 'unreadable' when it could not be read. */
async function readOne(db: Db, id: string): Promise<PlanetDossierRead | null> {
  try {
    const [rows, rounds] = await Promise.all([dossierList(db, id), dossierRounds(db, id)]);
    return rows[0] ? planetDossier(rows[0], rounds, dossierPath(id)) : null;
  } catch (err) {
    console.error(err);
    return 'unreadable';
  }
}

/**
 * The dossiers of the planets numbered `prds`, by PRD number, as the arcade takes them: a planet with
 * none is absent. 'unreadable' when the workspace or its dossiers cannot be read; a planet whose own
 * dossier cannot be read is 'unreadable' alone. Never throws: dossiers out of reach never take the
 * galaxy with them.
 */
export async function readDossiers(db: Db, workspace: string, prds: readonly number[]): Promise<DossiersRead> {
  if (!prds.length) return {};
  try {
    const home = await planRepo(db, workspace);
    if (!home) return {};
    const ids = await dossierIds(db, workspace, home);
    const found = [...new Set(prds)].flatMap((prd) => {
      const id = ids.get(prd);
      return id === undefined ? [] : [[prd, id] as const];
    });
    const read = await Promise.all(found.map(async ([prd, id]) => [prd, await readOne(db, id)] as const));
    return Object.fromEntries(read.filter((e): e is readonly [number, PlanetDossierRead] => e[1] !== null));
  } catch (err) {
    console.error(err);
    return 'unreadable';
  }
}

/**
 * Every dossier of `workspace` the caller may read, newest activity first, as dossier_list(p_workspace)
 * lists them (supabase/migrations/20261012100000_dossier_list_workspace.sql): the database keeps the one
 * workspace, set-based, so a dashboard never reads every workspace of its viewer to keep one. A concept
 * (PRD 1272) is left out: the dashboard counts PRDs and fixes, and concepts have their own list. Rejects
 * when the list cannot be read.
 */
export async function workspaceDossiers(db: Pick<SupabaseClient<Database>, 'rpc'>, workspace: string): Promise<DossierListRow[]> {
  const { data, error } = await db.rpc('dossier_list', { p_workspace: workspace });
  if (error) throw new Error(`Supabase: could not read the workspace's dossiers (${error.message})`);
  const rows = orThrow(parseRows(AnyListEntry, data, 'data/dossiers: dossier_list'));
  return orThrow(parseRows(DossierListEntry, rows.filter((row) => row.kind !== 'concept'), 'data/dossiers: dossier_list'));
}

// ── The demo's dossiers ─────────────────────────────────────────────────────────
// For the demo world's planets (@omni/galaxy's demo), as dossier_list() and dossier_rounds() would give
// them: the planet in distress the demo opens on, with no plan yet and a round still open; a planet being
// terraformed with its spec at v3 and eleven of twelve rounds answered; another with every round
// answered; and an old one the fallback read from GitHub, with no question. The others have none.

const HOUR = 3_600_000;

type DemoRound = { question: string; answer: string | null; more?: Record<string, string>; hoursAgo: number };
type DemoDossier = {
  prd: PrdNumber;
  title: string;
  /** Each artifact's latest version, and how many hours ago it was added. */
  latest: Partial<Record<DossierKind, { version: number; hoursAgo: number; source?: 'kit' | 'github' }>>;
  asked: number;
  answered: number;
  rounds: DemoRound[];
};

const DEMO: DemoDossier[] = [
  {
    prd: parsePrd(2410), title: 'Peppol e-Invoicing',
    latest: { 'before-after': { version: 1, hoursAgo: 70 }, spec: { version: 2, hoursAgo: 30 } },
    asked: 4, answered: 3,
    rounds: [
      { question: 'Which Peppol access point should send the invoices?', answer: 'Storecove (Recommended)', hoursAgo: 71 },
      { question: 'Should a failed delivery fall back to email?', answer: 'Yes, after two retries', hoursAgo: 52 },
      { question: 'Where does a client\'s Peppol ID live?', answer: 'On the client\'s company record', more: { 'Who may edit it?': 'Admins only' }, hoursAgo: 29 },
      { question: 'Should credit notes go through Peppol too?', answer: null, hoursAgo: 4 },
    ],
  },
  {
    prd: parsePrd(2332), title: 'Generic Import Engine',
    latest: { 'before-after': { version: 1, hoursAgo: 400 }, spec: { version: 3, hoursAgo: 60 }, plan: { version: 2, hoursAgo: 58 } },
    asked: 12, answered: 11,
    rounds: [
      { question: 'Which file formats should the first release read?', answer: 'CSV and Excel', hoursAgo: 390 },
      { question: 'How should a row that fails validation be reported?', answer: 'A downloadable report of the failed rows', hoursAgo: 120 },
      { question: 'Should an import run in the background?', answer: 'Yes, with a notification when it is done (Recommended)', hoursAgo: 61 },
      { question: 'May an import update records that already exist?', answer: 'Only when matched by reference', hoursAgo: 40 },
    ],
  },
  {
    prd: parsePrd(2520), title: 'Planning Drag & Drop',
    latest: { 'before-after': { version: 2, hoursAgo: 90 }, spec: { version: 1, hoursAgo: 200 }, plan: { version: 1, hoursAgo: 190 } },
    asked: 6, answered: 6,
    rounds: [
      { question: 'What happens when a task is dropped on a day off?', answer: 'It moves to the next working day', hoursAgo: 196 },
      { question: 'Should dragging snap to half days?', answer: 'Yes (Recommended)', hoursAgo: 150 },
      { question: 'Who may move another person\'s task?', answer: 'Planners and admins', hoursAgo: 95 },
    ],
  },
  {
    prd: parsePrd(985), title: 'Default Country per Company',
    latest: { spec: { version: 1, hoursAgo: 900, source: 'github' }, plan: { version: 1, hoursAgo: 900, source: 'github' } },
    asked: 0, answered: 0, rounds: [],
  },
];

/** A demo dossier's id: a uuid of its own, so its link has the shape of a real one. */
const demoId = (prd: PrdNumber) => `00000000-0000-4000-8000-${String(prd).padStart(12, '0')}`;

function demoRow(d: DemoDossier, now: number): { row: DossierListRow; rounds: DossierRoundRow[] } {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();
  const id = demoId(d.prd);
  const latest = Object.fromEntries(Object.entries(d.latest).map(([kind, v]) => [kind, {
    id: `${id}-${kind}-${v.version}`, version: v.version, source: v.source ?? 'kit', created_at: at(v.hoursAgo),
  }]));
  const rounds = d.rounds.map((r, i): DossierRoundRow => ({
    rule: 'brainstorm', round_id: `${id}-round-${i + 1}`, session_id: 'demo-terminal', asked_by: 'demo', repo: 'vertuoza/vertuo-omni-plan',
    branch: 'main', questions: [r.question, ...Object.keys(r.more ?? {})].map((question) => ({ question, header: '', multiSelect: false, options: [] })),
    answers: r.answer === null ? null : { [r.question]: r.answer, ...r.more }, status: r.answer === null ? 'open' : 'answered',
    answered_via: r.answer === null ? null : 'page', answered_by: r.answer === null ? null : 'demo', category: null, category_by: null,
    prd: d.prd, skill: null, created_at: at(r.hoursAgo + 0.1), answered_at: r.answer === null ? null : at(r.hoursAgo),
  }));
  const row: DossierListRow = {
    id, workspace_id: 'demo', home_repo: 'vertuoza/vertuo-omni-plan', prd: d.prd, title: d.title, opened_by: null,
    created_at: at(1000), numbered_at: at(999), repos: ['vertuoza/vertuo-omni-plan'], latest, asked: d.asked, answered: d.answered,
    last_activity: at(Math.min(...d.rounds.map((r) => r.hoursAgo), ...Object.values(d.latest).map((v) => v.hoursAgo))),
  };
  return { row, rounds };
}

/**
 * The demo world's dossiers, by PRD number, dated from `now` as the demo galaxy is. `open: false` in a
 * build with no page to open (the single-file artifact): no dossier links anywhere, so the tab shows no
 * OPEN hint.
 */
export function demoDossiers(now = new Date(), { open = true }: { open?: boolean } = {}): Record<number, PlanetDossier> {
  return Object.fromEntries(DEMO.map((d) => {
    const { row, rounds } = demoRow(d, now.getTime());
    return [d.prd, planetDossier(row, rounds, open ? dossierPath(row.id) : null)];
  }));
}
