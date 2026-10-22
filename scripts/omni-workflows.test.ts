// Every workflow of this repository that runs `omni` installs the workspace first (#2228). Here
// `.omni-loop/bin/omni.mjs` is a shim onto the kit's TypeScript source, and `kit/dist/omni.mjs`, the
// launcher, hands over to it inside the checkout (PRD 420), so either one stops on the first package
// the source imports when the job has no `node_modules`. The knowledge-graph workflow did, on its
// first run with its secret set. Nothing here runs a workflow.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = { uses?: string; run?: string };
type Job = { steps?: Step[] };

const root = new URL('../', import.meta.url);
const dir = new URL('.github/workflows/', root);
const read = (url: URL): string => readFileSync(fileURLToPath(url), 'utf8');

const INSTALL = 'pnpm install --frozen-lockfile';
const OMNI = /\bnode\s+(?:\.\/)?(?:\.omni-loop\/bin|kit\/dist)\/omni\.mjs\b/;

/** Each job's steps that run omni before the job installed the workspace, as `<file> › <job>`. */
function omniBeforeInstall(files: Readonly<Record<string, string>>): string[] {
  return Object.entries(files).flatMap(([file, text]) => {
    const workflow = parse(text) as { jobs?: Record<string, Job> } | null;
    return Object.entries(workflow?.jobs ?? {}).flatMap(([id, job]) => {
      const steps = job.steps ?? [];
      const omni = steps.findIndex((step) => OMNI.test(step.run ?? ''));
      if (omni < 0) return [];
      const installed = steps.slice(0, omni).some((step) => step.run?.trim() === INSTALL);
      return installed ? [] : [`${file} › ${id}`];
    });
  });
}

const workflows = Object.fromEntries(
  readdirSync(fileURLToPath(dir))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => [name, read(new URL(name, dir))]),
);

describe('when a workflow of this repository runs omni', () => {
  it("runs the kit's source here, which needs the workspace installed", () => {
    expect(read(new URL('.omni-loop/bin/omni.mjs', root))).toContain("from '../../kit/bin/omni.ts'");
  });

  it('installs the workspace in the same job, before omni runs', () => {
    expect(omniBeforeInstall(workflows)).toEqual([]);
  });

  it('is caught when a job runs omni with no install before it', () => {
    const job = (steps: string): string => `jobs:\n  push:\n    steps:\n${steps}`;
    expect(
      omniBeforeInstall({
        'bare.yml': job('      - uses: actions/checkout@v4\n      - run: node kit/dist/omni.mjs kb graph push\n'),
        'late.yml': job(`      - run: node .omni-loop/bin/omni.mjs check\n      - run: ${INSTALL}\n`),
        'ok.yml': job(`      - run: ${INSTALL}\n      - run: node .omni-loop/bin/omni.mjs check\n`),
        'none.yml': job('      - run: pnpm test\n'),
      }),
    ).toEqual(['bare.yml › push', 'late.yml › push']);
  });
});

describe('the knowledge-graph workflow the guide gives another repository', () => {
  const guide = read(new URL('docs/guide/products.md', root));
  const block = /```yaml file=\.github\/workflows\/knowledge-graph\.yml\n([\s\S]*?)```/.exec(guide)?.[1] ?? '';

  it("calls the kit that repository installed, the bundle at .omni-loop/bin, never this repository's kit/dist", () => {
    expect(block).toContain('node .omni-loop/bin/omni.mjs kb graph push');
    expect(block).not.toContain('kit/dist/');
  });
});
