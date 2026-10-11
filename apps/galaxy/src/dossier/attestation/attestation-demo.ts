import { sha256 } from 'vertuo-omni-plan/kit/lib/dossier/folder.ts';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { HeadFiles, TargetPull } from './attestation-github';
import type { AttestationFacts } from './attestation-facts';
import { attestationOf, type Attestation } from './attestation.service';

// The Attestation page in the demo (PRD 1612 s4): with no database, development plays PRD 918 of the
// before/after page, judged by the same rules as a live one. `?state=` picks the state to see: approved
// (the default), drifted, waiting or held. The names and figures are examples.

const DEMO_DOSSIER = '00000000-0000-4000-8000-00000000d055';
const DIR = '.omni-loop/delivery/inbox/0918-offline-sync';
const DEMO_HEAD = '4f1a2c0d9e8b7a6f5e4d3c2b1a0f9e8d7c6b5a49';
const IRISA = 'demo-irisa';
const YOU = 'demo-you';

const TEXTS = {
  spec: '# Offline sync\n\nThe field app keeps working without a network.\n',
  plan: '# Plan\n\n| s1 | the queue |\n| s2 | the replay |\n',
  'before-after': '<!doctype html><title>PRD 918</title>\n',
  voice: '{"rounds":[]}\n',
} as const;

const FILES = (['spec', 'plan', 'before-after', 'voice'] as const).map((kind) => ({
  kind, path: `${DIR}/${kind === 'before-after' ? 'before-after.html' : kind === 'voice' ? 'voice.json' : `${kind}.md`}`,
  version_id: `demo-${kind}`, sha256: sha256(TEXTS[kind]),
}));

const facts = (approved: boolean): AttestationFacts => ({
  dossier: { id: DEMO_DOSSIER, home_repo: 'vertuoza/vertuo-mobile-plan', prd: parsePrd(918) },
  approval: approved ? { id: 'demo-approval', approver_login: 'irisa', approved_at: '2026-10-08T14:02:00Z', files: FILES } : null,
  approvedBy: approved ? IRISA : null,
  voids: [],
  contents: new Map(FILES.map((f) => [f.version_id, TEXTS[f.kind]])),
  members: [IRISA, YOU],
  asked: [IRISA, YOU],
  workspace: 'vertuoza',
  product: { name: 'Mobile', repos: ['vertuoza/vertuo-mobile-plan', 'vertuoza/vertuo-api', 'vertuoza/vertuo-mobile'] },
});

const TARGETS: TargetPull[] = [
  { repo: 'vertuoza/vertuo-api', number: 446, url: 'https://github.com/vertuoza/vertuo-api/pull/446', state: 'open', draft: false },
  { repo: 'vertuoza/vertuo-mobile', number: 93, url: 'https://github.com/vertuoza/vertuo-mobile/pull/93', state: 'open', draft: false },
];

const headWith = (plan: string): HeadFiles => ({
  kind: 'read',
  files: new Map(FILES.map((f) => [f.path, f.kind === 'plan' ? plan : TEXTS[f.kind]])),
});

/** The demo's attestation in the state `?state=` names, at `head` (the demo's own when none is named). */
export function demoAttestation(state: string | null, head: string | null): Attestation {
  const at = head ?? DEMO_HEAD;
  switch (state) {
    case 'drifted': return attestationOf(facts(true), YOU, at, headWith(`${TEXTS.plan}\n`), TARGETS);
    case 'waiting': return attestationOf(facts(false), YOU, at, { kind: 'unread' }, TARGETS);
    case 'held': return attestationOf(facts(true), YOU, at, { kind: 'unread' }, TARGETS);
    default: return attestationOf(facts(true), YOU, at, headWith(TEXTS.plan), TARGETS);
  }
}
