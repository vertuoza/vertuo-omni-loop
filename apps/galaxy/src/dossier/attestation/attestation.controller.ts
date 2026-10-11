import 'server-only';
import type { ArcadeMode } from '../../data/mode';
import { serverEnv } from '../../env';
import { dossierSession } from '../page/route-gate';
import { dossierCallbackPath } from '../page/sign-in';
import { demoAttestation } from './attestation-demo';
import { livePorts } from './attestation-live';
import { headOf, readAttestation, type Attestation, type AttestationPorts } from './attestation.service';

// The Attestation page's controller (PRD 1612 s4; ADR-0095): /prd/<id>/attestation?head=<sha>, the
// omni/approved check's Details. Who reads it decides what it draws, checked first, as on /prd/<id>: the
// demo in development; with no database, closed; signed out, the sign-in card, and nothing is read;
// signed in, the attestation read as that person, so row-level security has the last word: a dossier of
// another workspace, one that never was, a draft or a fix is not found; a PRD approved in its repository
// (◇) says it has no attestation. `?head=` names the head the check ran on, a commit's sha; anything
// else reads as no head. A record that could not be read is the database notice, logged.

type Query = Record<string, string | string[] | undefined>;

/** What the page draws. */
export type AttestationScreen =
  | { kind: 'closed' }
  | { kind: 'database-down' }
  | { kind: 'sign-in'; supabase: { url: string; key: string }; returnPath: string; error: string | null }
  | { kind: 'not-found' }
  | { kind: 'repo-born'; prd: number; page: string }
  | { kind: 'attestation'; attestation: Attestation };

/** The database, its public settings and the signed-in person, as /prd/<id> reads them. */
type Session = NonNullable<Awaited<ReturnType<typeof dossierSession>>>;

export type AttestationDeps = {
  mode(): ArcadeMode;
  session(mode: ArcadeMode): Promise<Session | null>;
  ports(db: Session['db']): AttestationPorts;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export async function attestationScreenOf(id: string, query: Query, deps: AttestationDeps): Promise<AttestationScreen> {
  const head = headOf(one(query.head));
  const mode = deps.mode();
  if (mode === 'demo') return { kind: 'attestation', attestation: demoAttestation(one(query.state), head) };
  const session = await deps.session(mode);
  if (!session) return { kind: 'closed' };
  if (!session.user) return { kind: 'sign-in', supabase: session.env, returnPath: dossierCallbackPath(id), error: one(query.signin_error) };
  try {
    const read = await readAttestation(deps.ports(session.db), id, session.user.id, head);
    return read.kind === 'repo-born' ? { ...read, prd: Number(read.prd) } : read;
  } catch (error) {
    console.error(`Attestation: ${id} could not be read (${error instanceof Error ? error.message : String(error)})`);
    return { kind: 'database-down' };
  }
}

export const LIVE_ATTESTATION: AttestationDeps = {
  mode: () => serverEnv().mode,
  session: dossierSession,
  ports: livePorts,
};
