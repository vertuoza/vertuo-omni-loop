import 'server-only';
import { readForMeLive } from '../ask/page/for-me-live';
import { DEMO_YOU } from '../dashboard/demo';
import { arcadeMode } from '../data/mode';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { firstWorkspace } from '../data/workspace';
import { readWaitingQuestions } from '../waiting/source';
import type { WaitingSource } from '../waiting/view';
import type { WaitingQuestion } from '../waiting/waiting';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';

// Who is looking at an app page (PRD 438): what the sidebar and the top bar show of them, read once
// per request by the app shell's layouts. Each part that fails to read falls back on its own, and the
// read never throws: no session is signed out, no workspace is no name, no questions read is an empty
// Questions part marked unread, which the browser reads again (PRD 499). A failed read leaves the page
// rendering as signed out.

export type Viewer = ViewerView;

export const SIGNED_OUT: Viewer = SIGNED_OUT_VIEWER;

/** What the viewer reads of a Supabase user: a narrow shape, so a fake is easy to write. */
type Person = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  identities?: ReadonlyArray<{ provider: string; identity_data?: Record<string, unknown> }>;
};

/** Where the viewer is read from: the four reads, each allowed to throw. */
export interface ViewerSource {
  user(): Promise<Person | null>;
  workspace(userId: string): Promise<{ name: string } | null>;
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

export async function readViewer(source: ViewerSource): Promise<Viewer> {
  const user = await settle(() => source.user(), null);
  if (!user) return SIGNED_OUT;
  const [workspace, questions, live] = await Promise.all([
    settle(() => source.workspace(user.id), null),
    settle(() => source.questions(user.id), null),
    settle(async () => source.live(user.id), null),
  ]);
  return {
    signedIn: true,
    name: nameOf(user),
    login: loginOf(user),
    avatarUrl: text(user.user_metadata?.avatar_url),
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

/** The viewer of this request: the demo's hero in the demo, signed out with no database. */
export async function viewerLive(): Promise<Viewer> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') {
    return { ...SIGNED_OUT, signedIn: true, name: DEMO_YOU.name, login: DEMO_YOU.login, waiting: { questions: await demoQuestions(Date.now()), unread: false, source: { kind: 'demo' } } };
  }
  const env = supabaseEnv();
  if (mode === 'closed' || !env) return SIGNED_OUT;
  return readViewer({
    user: async (): Promise<Person | null> => {
      const { data: { user } } = await (await supabaseServer()).auth.getUser();
      return user;
    },
    workspace: async (userId) => firstWorkspace(await supabaseServer(), userId),
    questions: async (userId) => readWaitingQuestions(await supabaseServer(), userId, Date.now()),
    live: (userId) => ({ kind: 'database', url: env.url, key: env.key, me: userId }),
  });
}
