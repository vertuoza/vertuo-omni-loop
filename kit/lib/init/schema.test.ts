import { describe, expect, it } from 'vitest';
import {
  ClaudeMarketplacesSchema,
  ClaudePluginsSchema,
  CommandStatusLineSchema,
  GhLabelsSchema,
  GhPullRequestsSchema,
  GhRepoSchema,
  JsonObjectSchema,
  KitPackageSchema,
  ScriptsFileSchema,
} from './schema.ts';

/** The path of the first issue a refused value raises: the field it names. */
const failedPath = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues[0]?.path.map(String);

describe("init's schemas of what it reads from outside", () => {
  it('reads a JSON object, and refuses an array or null', () => {
    expect(JsonObjectSchema.parse({ a: 1 })).toEqual({ a: 1 });
    expect(JsonObjectSchema.safeParse([]).success).toBe(false);
    expect(JsonObjectSchema.safeParse(null).success).toBe(false);
  });

  it('reads the scripts of a package.json, and names `scripts` when they are no object', () => {
    expect(ScriptsFileSchema.parse({ name: 'x', scripts: { test: 'vitest' } }).scripts).toEqual({ test: 'vitest' });
    expect(ScriptsFileSchema.parse({ name: 'x' }).scripts).toBeUndefined();
    expect(failedPath(ScriptsFileSchema.safeParse({ scripts: ['test'] }))).toEqual(['scripts']);
  });

  it("reads the kit's version, null when it is not a non-empty string", () => {
    expect(KitPackageSchema.parse({ version: '0.0.144' }).version).toBe('0.0.144');
    expect(KitPackageSchema.parse({ version: '' }).version).toBeNull();
    expect(KitPackageSchema.parse({}).version).toBeNull();
    expect(KitPackageSchema.safeParse(null).success).toBe(false);
  });

  it('reads gh repo view, and names `nameWithOwner` when it is not text', () => {
    expect(GhRepoSchema.parse({ nameWithOwner: 'acme/widgets', defaultBranchRef: { name: 'main' } })).toEqual({
      nameWithOwner: 'acme/widgets',
      defaultBranchRef: { name: 'main' },
    });
    expect(failedPath(GhRepoSchema.safeParse({ nameWithOwner: 7 }))).toEqual(['nameWithOwner']);
  });

  it("reads gh label list, and names the label whose name is not text", () => {
    expect(GhLabelsSchema.parse([{ name: 'omni:prd' }])).toEqual([{ name: 'omni:prd' }]);
    expect(failedPath(GhLabelsSchema.safeParse([{ name: 'a' }, { name: null }]))).toEqual(['1', 'name']);
  });

  it('reads gh pr list, and names `number` when it is not a number', () => {
    expect(GhPullRequestsSchema.parse([{ url: 'https://github.com/a/b/pull/1', number: 1 }])).toHaveLength(1);
    expect(failedPath(GhPullRequestsSchema.safeParse([{ url: 'u', number: '1' }]))).toEqual(['0', 'number']);
  });

  it("reads claude's lists, an element that is no object reading as null", () => {
    expect(ClaudePluginsSchema.parse([{ id: 'omni@omni-loop' }, 'junk', null])).toEqual([{ id: 'omni@omni-loop' }, null, null]);
    expect(ClaudeMarketplacesSchema.parse([{ name: 'omni-loop' }, 3])).toEqual([{ name: 'omni-loop' }, null]);
    expect(ClaudePluginsSchema.safeParse({ id: 'omni@omni-loop' }).success).toBe(false);
  });

  it('reads a status line with a text command, and names `command` otherwise', () => {
    expect(CommandStatusLineSchema.parse({ type: 'command', command: 'node x statusline' }).command).toBe('node x statusline');
    expect(failedPath(CommandStatusLineSchema.safeParse({ type: 'command', command: 42 }))).toEqual(['command']);
  });
});
