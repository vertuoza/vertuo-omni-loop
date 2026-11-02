import type { Job, JobPart } from '../runners.contract';

// A job's agent and parts on the Runners page (PRD 2537 s3), as words: pure, so each part's line is tested without a
// page. A job names the agent and model of its last part beside its status (`codex · gpt-5-codex`), and a job that
// turned over to another account names each part under it: `claude-1 · Opus 5.5 · 13:41–14:02 · usage limit`, then
// `codex-1 · gpt-5-codex · since 14:02`. Times are UTC, as the rest of the app gives them.

/** A Claude model's name as people say it: `claude-opus-5-5` is `Opus 5.5`, a dated one drops its date; any other as it is. */
export function modelWords(model: string): string {
  const claude = /^claude-(opus|sonnet|haiku)-(\d+)-(\d+)(?:-\d{8})?(\[1m\])?$/.exec(model);
  if (claude === null) return model;
  const [, family = '', major = '', minor = '', million] = claude;
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}${million === undefined ? '' : ' (1M)'}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO time as `HH:MM`, UTC. */
const clock = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
};

/** Why a part ended, in the page's words; null for a part still running. */
const END_WORDS: Record<NonNullable<JobPart['ended']>, string> = {
  usage: 'usage warning', context: 'context full', limit: 'usage limit', done: 'done', failed: 'failed',
};

/** The agent and model a part ran: `codex · gpt-5-codex`, `claude · Opus 5.5`, or the agent alone when it named no model. */
const ranWith = (part: Pick<JobPart, 'agent' | 'model'>): string => (part.model === null ? part.agent : `${part.agent} · ${modelWords(part.model)}`);

/** Beside a job's status, the agent and model of its last part; null for a job whose runner reported no part. */
export function jobAgentWords(job: Pick<Job, 'parts'>): string | null {
  const last = job.parts?.at(-1);
  return last === undefined ? null : ranWith(last);
}

/** One part's line: its account and model, when it ran, and why it ended; `since <time>` while it runs. */
function partLine(part: JobPart): { text: string; title: string | null } {
  const who = part.model === null ? part.account : `${part.account} · ${modelWords(part.model)}`;
  if (part.to === null || part.ended === null) return { text: `${who} · since ${clock(part.from)}`, title: `${part.agent}, running` };
  const out = part.resetsAt ? `${part.account} out until ${clock(part.resetsAt)} UTC${part.guessed === true ? ' (guessed)' : ''}` : null;
  return { text: `${who} · ${clock(part.from)}–${clock(part.to)} · ${END_WORDS[part.ended]}`, title: [part.agent, out].filter((words) => words !== null).join(', ') };
}

/** Under a job that turned over, one line per part, in order; none for a job that ran on one account. */
export function partLines(job: Pick<Job, 'parts'>): { text: string; title: string | null }[] {
  const parts = job.parts ?? [];
  return parts.length < 2 ? [] : parts.map(partLine);
}
