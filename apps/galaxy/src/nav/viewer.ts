import 'server-only';
import { readForMeLive } from '../ask/page/for-me-live';
import { DEMO_YOU } from '../dashboard/demo';
import { viewer } from '../data/viewer';
import { loadFleets, loadMe } from '../data/load-galaxy';
import { faceOf } from '../people/face';
import type { WaitingSource } from '../waiting/view';
import type { WaitingQuestion } from '../waiting/waiting';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';

// Who is looking at an app page (PRD 438): what the sidebar and the top bar show of them, read once
// per request by the app shell's layouts. Each part that fails to read falls back on its own, and the
// read never throws: no session is signed out, no workspace is no name, no questions read is an empty
// Questions part marked unread, which the browser reads again (PRD 499). A failed read leaves the page
// rendering as signed out. PRD 652: the viewer's own player row in that workspace gives the user menu
// their hero; with none, or a failed read, the menu keeps their GitHub avatar or initial.

export type Viewer = ViewerView;

export const SIGNED_OUT: Viewer = SIGNED_OUT_VIEWER;

/** What the viewer reads of a Supabase user: a narrow shape, so a fake is easy to write. */
type Person = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  identities?: ReadonlyArray<{ provider: string; identity_data?: Record<string, unknown> }>;
};

/** Where the viewer is read from: the five reads, each allowed to throw. */
export interface ViewerSource {
  user(): Promise<Person | null>;
  workspace(userId: string): Promise<{ id: string; name: string } | null>;
  /** Their player row in the workspace: its stored hero, unchecked, and their fleet's colour. */
  player(userId: string, workspaceId: string): Promise<{ hero: unknown; color: string | null } | null>;
  /** The waiting list's Questions part (PRD 499). */
  questions(userId: string): Promise<WaitingQuestion[]>;
  /** Where the browser reads it again. */
  live(userId: string): WaitingSource | null;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The person's GitHub login, when they signed in with GitHub (the fix lists' Mine reads it too, issue 674). */
export const loginOf = (user: Person) => {
  const d = user.identities?.find((i) => i.provider === 'github')?.identity_data ?? null;
  return text(d?.user_name) ?? text(d?.preferred_username);
};

const nameOf = (user: Person) => {
  const m = user.user_metadata ?? {};
  return text(m.full_name) ?? text(m.name) ?? text(m.user_name) ?? text(user.email?.split('@')[0]);
};

async function settle<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

/** The hero of a player row, drawn as every person's face is (faceOf), or null when it holds none. */
function heroOf(player: { hero: unknown; color: string | null } | null): string | null {
  if (!player) return null;
  const face = faceOf({ name: '', hero: player.hero, color: player.color });
  return face.kind === 'hero' ? face.svg : null;
}

export async function readViewer(source: ViewerSource): Promise<Viewer> {
  const user = await settle(() => source.user(), null);
  if (!user) return SIGNED_OUT;
  const [[workspace, player], questions, live] = await Promise.all([
    settle(() => source.workspace(user.id), null).then(async (w) => [w, w ? await settle(() => source.player(user.id, w.id), null) : null] as const),
    settle(() => source.questions(user.id), null),
    settle(() => Promise.resolve(source.live(user.id)), null),
  ]);
  return {
    signedIn: true,
    name: nameOf(user),
    login: loginOf(user),
    avatarUrl: text(user.user_metadata?.avatar_url),
    heroSvg: heroOf(player),
    workspaceName: text(workspace?.name),
    waiting: { questions: questions ?? [], unread: questions === null, source: live },
  };
}

/** The demo's Questions part: the one question a teammate shares with its hero. */
async function demoQuestions(now: number): Promise<WaitingQuestion[]> {
  const read = await readForMeLive(now);
  if (read.kind !== 'entries') return [];
  return read.entries.map((e) => ({
    kind: 'question', id: e.roundId, sessionTitle: e.sessionTitle, question: e.question, askedAt: now - 2 * 60_000, sharedBy: e.sharedBy,
  }));
}

/** The viewer of this request: the demo's hero in the demo, signed out with no database. Read through
 * viewer() (PRD 657): the client, the user, the workspace and the questions are the page's own, read
 * once per request. */
export async function viewerLive(): Promise<Viewer> {
  const seen = await settle(() => viewer(), null);
  if (seen?.kind === 'demo') {
    return { ...SIGNED_OUT, signedIn: true, name: DEMO_YOU.name, login: DEMO_YOU.login, waiting: { questions: await demoQuestions(Date.now()), unread: false, source: { kind: 'demo' } } };
  }
  if (seen?.kind !== 'signed-in') return SIGNED_OUT;
  const { env, user } = seen;
  return readViewer({
    user: () => Promise.resolve(user),
    workspace: () => seen.workspace(),
    player: async (userId, workspaceId) => {
      const [me, fleets] = await Promise.all([loadMe(seen.db, workspaceId, userId), loadFleets(seen.db, workspaceId)]);
      return me && { hero: me.hero, color: fleets.find((f) => f.name === me.team)?.color ?? null };
    },
    questions: () => seen.questions(),
    live: (userId) => ({ kind: 'database', url: env.url, key: env.key, me: userId }),
  });
}
