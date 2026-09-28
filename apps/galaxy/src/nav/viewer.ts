import 'server-only';
import { forMeCount } from '../ask/page/for-me-live';
import { DEMO_YOU } from '../dashboard/demo';
import { arcadeMode } from '../data/mode';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { firstWorkspace } from '../data/workspace';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';

// Who is looking at an app page (PRD 438): what the sidebar and the top bar show of them, read once
// per request by the app shell's layouts. Each part that fails to read falls back on its own, and the
// read never throws: no session is signed out, no workspace is no name, no count is `forMe: null`. A
// failed read leaves the page rendering as signed out.

export type Viewer = ViewerView;

export const SIGNED_OUT: Viewer = SIGNED_OUT_VIEWER;

/** What the viewer reads of a Supabase user: a narrow shape, so a fake is easy to write. */
type Person = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  identities?: ReadonlyArray<{ provider: string; identity_data?: Record<string, unknown> }>;
};

/** Where the viewer is read from: the three reads, each allowed to throw. */
export interface ViewerSource {
  user(): Promise<Person | null>;
  workspace(userId: string): Promise<{ name: string } | null>;
  forMe(): Promise<number | null>;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const loginOf = (user: Person) => {
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
  const [workspace, forMe] = await Promise.all([settle(() => source.workspace(user.id), null), settle(() => source.forMe(), null)]);
  return {
    signedIn: true,
    name: nameOf(user),
    login: loginOf(user),
    avatarUrl: text(user.user_metadata?.avatar_url),
    workspaceName: text(workspace?.name),
    forMe,
  };
}

/** The viewer of this request: the demo's hero in the demo, signed out with no database. */
export async function viewerLive(): Promise<Viewer> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') {
    return { ...SIGNED_OUT, signedIn: true, name: DEMO_YOU.name, login: DEMO_YOU.login, forMe: await forMeCount(Date.now()) };
  }
  if (mode === 'closed' || !supabaseEnv()) return SIGNED_OUT;
  return readViewer({
    user: async (): Promise<Person | null> => {
      const { data: { user } } = await (await supabaseServer()).auth.getUser();
      return user;
    },
    workspace: async (userId) => firstWorkspace(await supabaseServer(), userId),
    forMe: () => forMeCount(Date.now()),
  });
}
