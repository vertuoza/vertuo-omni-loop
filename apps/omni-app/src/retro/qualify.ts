// `qualify`: a merged pull request in, the PRD it delivered out — or why it gets no retro (PRD 72,
// decision 12). It reads the config at the merge SHA, never the head's, so a pull request cannot
// repoint its own retro. A feature PR by the app's existing rule: merged into `repo.defaultBranch`,
// its head matching `branches.feature`, and a PRD folder for the topic at the merge SHA (shipped, or
// inbox for a PRD merged without being shipped). The label is not required.
//
// The step's output is plain JSON: every later step reads the PRD's plan, settled file, title and
// problem from here rather than from GitHub again.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_FILE } from 'vertuo-omni-plan/kit/lib/config.ts';
import { foldersLayout, parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { readBaseConfig } from '../outbox-check/github.ts';
import { listFolder, readFiles, readPull } from './github.ts';
import type { Config, FeaturePull, Octokit, Pull, PrdFacts } from './retro.types.ts';

export type Qualified = { skip: string; pr?: Pull } | { skip: null; pr: FeaturePull; prd: PrdFacts; config: Config };

type Repo = { owner: string; repo: string };

export async function qualify(
  octokit: Octokit,
  { owner, repo, prNumber, mergeSha }: Repo & { prNumber: number; mergeSha: string },
): Promise<Qualified> {
  const read = await readPull(octokit, { owner, repo, prNumber });
  if (!read.merged) return { skip: `#${prNumber} was closed, not merged.`, pr: read };
  const pr: FeaturePull = Object.assign(read, { mergeSha });

  const { config, error } = await configAt(octokit, { owner, repo, sha: mergeSha });
  if (error) return { skip: error.message.split('\n')[0] ?? '', pr };
  if (!config) return { skip: `No \`${CONFIG_FILE}\` at the merge ${mergeSha}.`, pr };

  const { defaultBranch } = config.repo;
  if (pr.baseRef !== defaultBranch) {
    return { skip: `The base \`${pr.baseRef}\` is not the default branch \`${defaultBranch}\`.`, pr };
  }
  const topic = topicOf(pr.headRef, config.branches.feature);
  if (topic === null) return { skip: `The head \`${pr.headRef}\` does not match \`${config.branches.feature}\`.`, pr };

  const dirs = foldersLayout('', config.paths).dirs;
  const found = await prdFolder(octokit, { owner, repo, sha: mergeSha, dirs, topic });
  if (!found) {
    return { skip: `No PRD folder for the topic \`${topic}\` under \`${config.paths.delivery}\` at the merge.`, pr };
  }

  const folder = `${dirs[found.state]}/${found.name}`;
  const settledPath = found.state === 'shipped' ? `${folder}/outbox/settled.md` : `${dirs.outbox}/${found.name}/settled.md`;
  const files = await readFiles(octokit, {
    owner,
    repo,
    ref: mergeSha,
    paths: [`${folder}/spec.md`, `${folder}/plan.md`, settledPath],
  });
  const spec = files[`${folder}/spec.md`] ?? '';

  return {
    skip: null,
    pr,
    config,
    prd: {
      number: found.prd,
      topic,
      title: specTitle(spec) ?? topic,
      problem: section(spec, 'Problem'),
      state: found.state,
      folder,
      plan: files[`${folder}/plan.md`] ?? null,
      settled: files[settledPath] ?? null,
    },
  };
}

/** The `{topic}` a head branch was cut for, read back through `branches.feature`, or `null`. */
export function topicOf(headRef: string, featureTemplate: string): string | null {
  if (!featureTemplate.includes('{topic}')) return null;
  const [prefix = '', suffix = ''] = featureTemplate.split('{topic}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const topic = headRef.slice(prefix.length, headRef.length - suffix.length);
  return topic && !topic.includes('/') ? topic : null;
}

async function configAt(octokit: Octokit, { owner, repo, sha }: Repo & { sha: string }): Promise<{ config: Config | null; error: Error | null }> {
  const dest = mkdtempSync(join(tmpdir(), 'omni-retro-config-'));
  try {
    return await readBaseConfig(octokit, { owner, repo, baseSha: sha, dest });
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

/** The PRD folder carrying `topic` at the merge: shipped first, then the inbox. */
async function prdFolder(
  octokit: Octokit,
  { owner, repo, sha, dirs, topic }: Repo & { sha: string; dirs: Record<PrdFacts['state'], string>; topic: string },
): Promise<{ state: PrdFacts['state']; name: string; prd: number } | null> {
  for (const state of ['shipped', 'inbox'] as const) {
    const entries = (await listFolder(octokit, { owner, repo, ref: sha, path: dirs[state] })) ?? [];
    for (const entry of entries) {
      const parsed = entry.type === 'tree' ? parseFolderName(entry.name) : null;
      if (parsed?.topic === topic) return { state, name: entry.name, prd: parsed.prd };
    }
  }
  return null;
}

/** The `title:` of a spec's front matter, unquoted, or `null`. */
function specTitle(spec: string): string | null {
  const front = /^---\n([\s\S]*?)\n---/.exec(spec);
  const line = front && /^title:\s*(.+)$/m.exec(front[1] ?? '');
  if (!line) return null;
  return (line[1] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2') || null;
}

/** The text under a `## <name>` heading, up to the next heading of that level, trimmed. */
function section(markdown: string, name: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${name}`);
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  return lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .join('\n')
    .trim();
}
