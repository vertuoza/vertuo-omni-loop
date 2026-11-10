// A ◆ PRD's spec judged against its business laws, once (PRD 2632 s4): the rules between the database's reads
// (./verdicts.repository.ts) and the judge (./judge.service.ts).
//
// - `ensure(dossier)`, as the service role: the verdict kept for the dossier's latest spec at its law home's
//   newest pack; with none kept yet, the spec is judged and the verdict kept, so the same spec and pack never
//   call the model twice. A dossier that is no ◆ PRD, has no spec, no law home, no pack or no law gives none,
//   with why, and nothing is kept: there is nothing to judge at.
// - `lawsOf(dossier)`: what the PRD's page shows, and what the approval route judges first. It starts from the
//   caller's own read (`standing`, null for anyone but a member), so a stranger never sets the judge going; a
//   member's spec with no verdict at the newest pack is judged then. It never throws: a failure is shown as
//   not judged, with why, and the database still refuses a red on Approve.
//
// The laws are read from the pack's files with the kit's one parser (./law-home.ts), under the knowledge root
// and the owners (`laws.owners`) the law home's own config names. Merged laws only: a pack is what the App
// kept when the law home's default branch merged.
import { lawOwnerParts, parseConfig } from 'omni-loop/kit/lib/config.ts';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { lawsOfPackFiles } from './law-home';
import { judgeSpec, type AskLaws } from './judge.service';
import type { JudgeInput, KeptVerdict, Standing, VerdictsRepository } from './verdicts.repository';

/** The law home's config, as a pack keeps it. */
const CONFIG_PATH = '.omni-loop/config.yml';

/** Why a dossier has no verdict to show: not a ◆ PRD with a spec, no law home, no pack yet, or no law. */
type NoVerdict = 'not-judged-here' | 'no-law-home' | 'no-pack' | 'no-law';

/** What `ensure` answers: the verdict kept, or why there is none. */
type Ensured = { kept: KeptVerdict } | { none: NoVerdict };

/** What the page shows of a spec's business laws. */
export type LawsView =
  | { show: 'nothing' }
  | { show: 'not-judged'; why: string }
  | { show: 'verdict'; verdict: KeptVerdict };

/** Why the page says a spec was not judged when its law home has no pack yet; any other `none` shows nothing. */
const NO_PACK = 'the law home has no knowledge pack yet';

/** One break as the terminal reads it: the law, the spec's words, and what the judge found broken, when kept. */
type FindingAnswer = { law: string; statement: string; quote: string; broken?: string };

/** Where a spec stands with its business laws, as the approval route tells the terminal (bug #2696):
 * `pending` while the latest spec has no verdict yet, else the verdict, a red with its findings. */
export type LawsAnswer =
  | { state: 'pending' }
  | { state: 'green' | 'red' | 'neutral'; reason: string; judgedAt?: string; findings: FindingAnswer[] };

/** What the terminal reads of the standing `read`; null where nothing is judged. It never judges. */
export function standingAnswer(read: Standing | null): LawsAnswer | null {
  if (read === null || read.lawHome === null || read.specVersion === null) return null;
  if (read.verdict === null) return read.packSha === null ? { state: 'neutral', reason: NO_PACK, findings: [] } : { state: 'pending' };
  const { state, reason, judgedAt, findings } = read.verdict;
  return {
    state,
    reason,
    judgedAt,
    findings: findings.map(({ law, statement, quote, broken }) => ({ law, statement, quote, ...(broken ? { broken } : {}) })),
  };
}

/** The knowledge root and the owners' logins a pack's config names; the defaults when it has none or it does not parse. */
export function configOf(files: readonly { path: string; content: string }[]): { root: string; owners: string[] } {
  const text = files.find((file) => file.path === CONFIG_PATH)?.content;
  if (text === undefined) return { root: '.omni-loop/knowledge', owners: [] };
  try {
    const config = parseConfig(text, CONFIG_PATH, { ignoreUnknownKeys: true });
    return { root: config.paths.knowledge, owners: config.laws.owners.map((entry) => lawOwnerParts(entry).owner) };
  } catch {
    return { root: '.omni-loop/knowledge', owners: [] };
  }
}

/** Each domain taken, with the product's name for it when it has one. */
function named(domains: JudgeInput['domains']) {
  const names = new Map(domains.map((domain) => [domain.key, domain.name]));
  return <D extends { key: string }>(domain: D): D & { name?: string } => {
    const name = names.get(domain.key);
    return name === undefined ? domain : { ...domain, name };
  };
}

export function verdictService({ service, ask }: { service: VerdictsRepository; ask: AskLaws | null }) {
  async function ensure(dossier: string): Promise<Ensured> {
    const input = await service.judgeInput(dossier);
    if (input === null || !input.server || input.specVersion === null || input.spec === null) return { none: 'not-judged-here' };
    if (input.lawHome === null) return { none: 'no-law-home' };
    if (input.pack === null) return { none: 'no-pack' };
    if (input.verdict !== null) return { kept: input.verdict };
    const { root, owners } = configOf(input.pack.files);
    const laws = lawsOfPackFiles(input.pack.files, root);
    if (laws.length === 0) return { none: 'no-law' };
    const verdict = await judgeSpec({ spec: input.spec, laws, glossary: input.glossary, owners, ask });
    const withNames = { ...verdict, domains: verdict.domains.map(named(input.domains)) };
    return { kept: await service.put(input.specVersion, input.pack.sha, withNames) };
  }

  /** What the page shows of the standing `standing` reads, judging the spec when it has no verdict yet. */
  async function lawsOf(dossier: string, standing: () => Promise<Standing | null>): Promise<LawsView> {
    try {
      const read = await standing();
      if (read === null || read.lawHome === null || read.specVersion === null) return { show: 'nothing' };
      if (read.verdict !== null) return { show: 'verdict', verdict: read.verdict };
      if (read.packSha === null) return { show: 'not-judged', why: NO_PACK };
      const ensured = await ensure(dossier);
      if ('kept' in ensured) return { show: 'verdict', verdict: ensured.kept };
      return ensured.none === 'no-pack' ? { show: 'not-judged', why: NO_PACK } : { show: 'nothing' };
    } catch (error) {
      log.error({ event: 'business-laws', outcome: 'failed', error });
      return { show: 'not-judged', why: 'the verdict could not be read' };
    }
  }

  return { ensure, lawsOf };
}

export type VerdictService = ReturnType<typeof verdictService>;
