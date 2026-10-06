import { readEnv } from '../../kit/lib/env/read.ts';
import { describe, it, expect } from 'vitest';
import { workspaceArg, githubOf } from './workspace.ts';

describe('workspaceArg', () => {
  it('takes --workspace out of the arguments, wherever it stands, and leaves the rest in order', () => {
    expect(workspaceArg(['--workspace', 'vertuoza'], null)).toEqual({ slug: 'vertuoza', argv: [] });
    expect(workspaceArg(['2026-08', '--workspace', 'acme', '--rankings', 'out.md'], null)).toEqual({ slug: 'acme', argv: ['2026-08', '--rankings', 'out.md'] });
    expect(workspaceArg(['backup/', '--workspace=acme'], null)).toEqual({ slug: 'acme', argv: ['backup/'] });
  });

  it('falls back to OMNI_LOOP_WORKSPACE', () => {
    expect(workspaceArg(['2332'], { slug: 'vertuoza' })).toEqual({ slug: 'vertuoza', argv: ['2332'] });
  });

  it('lets --workspace beat OMNI_LOOP_WORKSPACE', () => {
    expect(workspaceArg(['--workspace', 'acme'], { slug: 'vertuoza' }).slug).toBe('acme');
  });

  it('has no default: with neither, it names both ways to name one', () => {
    expect(() => workspaceArg([], null)).toThrow(/no workspace named.*--workspace <slug>.*OMNI_LOOP_WORKSPACE/);
    expect(() => workspaceArg(['2332'], readEnv({ OMNI_LOOP_WORKSPACE: '' }).workspace)).toThrow(/no workspace named/);
  });

  it('refuses a --workspace without a slug, or given twice', () => {
    expect(() => workspaceArg(['--workspace'], { slug: 'vertuoza' })).toThrow(/--workspace needs a slug/);
    expect(() => workspaceArg(['--workspace', '--rankings', 'out.md'], null)).toThrow(/--workspace needs a slug/);
    expect(() => workspaceArg(['--workspace='], null)).toThrow(/--workspace needs a slug/);
    expect(() => workspaceArg(['--workspace', 'a', '--workspace', 'b'], null)).toThrow(/twice/);
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
