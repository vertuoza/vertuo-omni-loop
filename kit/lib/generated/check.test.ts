// PRD 1138: a `generated` list that lies is red — what `omni check config` refuses in it.
import { describe, expect, it } from 'vitest';
import { generatedViolations } from './check.ts';

const TRACKED = ['out/bundle.mjs', 'src/a.ts', 'lib/b.ts', 'build.ts', 'scripts/make.sh', 'package.json'];
const SCRIPTS = ['build', 'test'];
const entry = (over: Record<string, unknown> = {}) => ({ path: 'out/', from: ['src/', 'lib/'], build: 'pnpm build', ...over });
const grade = (entries: ReturnType<typeof entry>[]) => generatedViolations(entries, { tracked: TRACKED, scripts: SCRIPTS });

describe('generatedViolations', () => {
  it('passes entries whose path, sources and build all exist', () => {
    expect(grade([entry(), entry({ path: 'out/bundle.mjs', from: ['src/a.ts'], build: 'node build.ts' })])).toEqual([]);
  });

  it.each([
    ['pnpm <script>', 'pnpm build'],
    ['pnpm run <script>', 'pnpm run build'],
    ['pnpm with a flag', 'pnpm -s build'],
    ['npm run <script>', 'npm run build'],
    ['npm test', 'npm test'],
    ['yarn <script>', 'yarn build'],
    ['bun run <script>', 'bun run build'],
    ['node <file>', 'node build.ts'],
    ['node with a flag', 'node --experimental-strip-types build.ts --out x'],
    ['a tracked file run itself', 'scripts/make.sh'],
    ['a tracked file run as ./', './scripts/make.sh'],
  ])('takes %s as a build', (_what, build) => {
    expect(grade([entry({ build })])).toEqual([]);
  });

  it('refuses a path that matches nothing tracked, naming the entry', () => {
    expect(grade([entry({ path: 'dist/' })])).toEqual(['generated.0 (dist/): path dist/ matches no tracked file']);
  });

  it('refuses each from prefix that matches nothing tracked, one line each', () => {
    expect(grade([entry(), entry({ from: ['gone/', 'lib/', 'nope/'] })])).toEqual([
      'generated.1 (out/): from gone/ matches no tracked file',
      'generated.1 (out/): from nope/ matches no tracked file',
    ]);
  });

  it.each([
    ['a script the root package.json lacks', 'pnpm deploy', 'generated.0 (out/): build pnpm deploy — deploy is no script of the root package.json'],
    ['a runner with no script', 'npm run', 'generated.0 (out/): build npm run — names no script of the root package.json'],
    ['a node file that is not tracked', 'node gone.ts', 'generated.0 (out/): build node gone.ts — gone.ts is not a tracked file'],
    ['node with no file', 'node', 'generated.0 (out/): build node — names no tracked file'],
    ['any other command', 'make dist', 'generated.0 (out/): build make dist — make is neither a package.json script runner, node <file>, nor a tracked file'],
  ])('refuses %s', (_what, build, line) => {
    expect(grade([entry({ build })])).toEqual([line]);
  });

  it('reads no package.json scripts as none', () => {
    expect(generatedViolations([entry()], { tracked: TRACKED, scripts: [] })).toEqual([
      'generated.0 (out/): build pnpm build — build is no script of the root package.json',
    ]);
  });
});
