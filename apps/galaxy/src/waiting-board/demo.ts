import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { peopleOf } from '../people/load';
import { boardOf, prdKey, type PrdPage, type StoredWait, type TabId } from './board';
import type { WaitingBoardData } from './waiting-board.service';

// The demo's Waiting board (PRD 2377 s3), for development and OMNI_LOOP_DEMO=1: example waits of two
// made-up repositories, one of each kind, a team and a "any approver" turn among them, a bug fix with no
// PRD, one wait past the limit and one under a day old. Fixed: the same `now` draws the same board.

const DAY = 86_400_000;
const HOUR = 3_600_000;

const DEMO_PEOPLE = peopleOf(
  [
    { user_id: 'demo-ada', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: null, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
    { user_id: 'demo-dora', name: 'Dora', github_login: 'dora', avatar_url: null, fleet: null, hero: { v: 1, body: 'boy', skin: 2, hair: 1, suit: 1, cape: 0 } },
  ],
  [],
);

// The demo's reader is Ada: she opened the two widgets PRDs, Dora the two gears ones.
const DEMO_VIEWER = { id: 'demo-ada', login: 'ada' };

const PRDS: [string, number, string, string][] = [
  ['acme/widgets', 41, 'Reusable widget themes', 'demo-ada'],
  ['acme/widgets', 44, 'Export a widget as an image', 'demo-ada'],
  ['acme/gears', 12, 'Faster gear ratios', 'demo-dora'],
  ['acme/gears', 15, 'A gear calculator', 'demo-dora'],
];

/** The demo's board at `now`. */
export function demoWaitingBoard(now: Date, tab: TabId = 'workspace'): WaitingBoardData {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const wait = (n: number, w: Omit<StoredWait, 'id'>): StoredWait => ({ id: `demo-wait-${n}`, ...w });
  const waits: StoredWait[] = [
    wait(1, { repo: 'acme/widgets', prd: parsePrd(41), pr: parsePr(310), kind: 'review', turn: ['ada'], since: ago(9 * DAY) }),
    wait(2, { repo: 'acme/widgets', prd: parsePrd(44), pr: parsePr(318), kind: 'merge', turn: ['dora'], since: ago(5 * DAY) }),
    wait(3, { repo: 'acme/gears', prd: parsePrd(12), pr: parsePr(77), kind: 'outbox', turn: ['dora'], since: ago(3 * DAY + 2 * HOUR) }),
    wait(4, { repo: 'acme/gears', prd: parsePrd(15), pr: null, kind: 'approval', turn: ['ada', 'dora'], since: ago(DAY + HOUR) }),
    wait(5, { repo: 'acme/widgets', prd: null, pr: parsePr(322), kind: 'review', turn: ['acme/maintainers'], since: ago(4 * HOUR) }),
    wait(6, { repo: 'acme/gears', prd: parsePrd(12), pr: parsePr(79), kind: 'law', turn: [], since: ago(2 * HOUR) }),
  ];
  const dossiers = new Map(PRDS.map(([repo, prd, title, owner], i): [string, PrdPage] => [prdKey(repo, parsePrd(prd)), { id: `demo-dossier-${i + 1}`, title, owner }]));
  const synced = new Map<string, string | null>([['acme/widgets', ago(5 * 60_000)], ['acme/gears', ago(50 * 60_000)]]);
  return {
    board: boardOf({ waits, dossiers, questions: new Map([[prdKey('acme/gears', parsePrd(12)), 2]]), synced, now, viewer: DEMO_VIEWER, tab }, DEMO_PEOPLE),
    filter: null,
    productsUnreadable: false,
  };
}
