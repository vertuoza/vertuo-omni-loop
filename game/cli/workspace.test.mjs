import { describe, it, expect } from 'vitest';
import { workspaceArg, githubOf } from './workspace.mjs';

describe('workspaceArg', () => {
  it('takes --workspace out of the arguments, wherever it stands, and leaves the rest in order', () => {
    expect(workspaceArg(['--workspace', 'vertuoza'], {})).toEqual({ slug: 'vertuoza', argv: [] });
    expect(workspaceArg(['2026-08', '--workspace', 'acme', '--rankings', 'out.md'], {})).toEqual({ slug: 'acme', argv: ['2026-08', '--rankings', 'out.md'] });
    expect(workspaceArg(['backup/', '--workspace=acme'], {})).toEqual({ slug: 'acme', argv: ['backup/'] });
  });

  it('falls back to OMNI_LOOP_WORKSPACE', () => {
    expect(workspaceArg(['2332'], { OMNI_LOOP_WORKSPACE: 'vertuoza' })).toEqual({ slug: 'vertuoza', argv: ['2332'] });
  });

  it('lets --workspace beat OMNI_LOOP_WORKSPACE', () => {
    expect(workspaceArg(['--workspace', 'acme'], { OMNI_LOOP_WORKSPACE: 'vertuoza' }).slug).toBe('acme');
  });

  it('has no default: with neither, it names both ways to name one', () => {
    expect(() => workspaceArg([], {})).toThrow(/no workspace named.*--workspace <slug>.*OMNI_LOOP_WORKSPACE/);
    expect(() => workspaceArg(['2332'], { OMNI_LOOP_WORKSPACE: '' })).toThrow(/no workspace named/);
  });

  it('refuses a --workspace without a slug, or given twice', () => {
    expect(() => workspaceArg(['--workspace'], { OMNI_LOOP_WORKSPACE: 'vertuoza' })).toThrow(/--workspace needs a slug/);
    expect(() => workspaceArg(['--workspace', '--rankings', 'out.md'], {})).toThrow(/--workspace needs a slug/);
    expect(() => workspaceArg(['--workspace='], {})).toThrow(/--workspace needs a slug/);
    expect(() => workspaceArg(['--workspace', 'a', '--workspace', 'b'], {})).toThrow(/twice/);
  });
});

describe('githubOf', () => {
  it('reads the organisation and the plan repository from the workspace', () => {
    expect(githubOf({ slug: 'vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan' })).toEqual({ org: 'vertuoza', planRepo: 'vertuo-omni-plan' });
  });

  it('refuses a workspace that names no GitHub organisation or plan repository, naming the workspace', () => {
    expect(() => githubOf({ slug: 'acme', github_org: null, plan_repo: 'acme-plan' })).toThrow(/workspace "acme" has no github_org/);
    expect(() => githubOf({ slug: 'acme', github_org: 'acme-gh', plan_repo: null })).toThrow(/workspace "acme" has no plan_repo/);
  });
});
