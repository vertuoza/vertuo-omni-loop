import { describe, expect, it } from 'vitest';
import { CheckRequestDataSchema } from '../inngest-client.ts';
import { readIssue } from '../inbox-check/github.ts';
import { readPull } from './github.ts';
import { messageOf, statusOf } from './github-schema.ts';

const answering = (data: unknown) => ({ request: () => Promise.resolve({ data }) });
const WHERE = { owner: 'acme', repo: 'widgets' };

describe('github-schema — a GitHub answer of another shape fails by the name of its field', () => {
  it('reads a pull request GitHub answers in its own shape', async () => {
    const pull = { base: { ref: 'main', sha: 'b1' }, head: { ref: 'feat/x', sha: 'h1' }, labels: [{ name: 'omni:feature' }, 'loose'] };
    await expect(readPull(answering(pull), { ...WHERE, prNumber: 1 })).resolves.toEqual({
      baseRef: 'main',
      baseSha: 'b1',
      headRef: 'feat/x',
      headSha: 'h1',
      labels: ['omni:feature', 'loose'],
    });
  });

  it('refuses a pull request without its base SHA, naming the field', async () => {
    const pull = { base: { ref: 'main' }, head: { ref: 'feat/x', sha: 'h1' } };
    await expect(readPull(answering(pull), { ...WHERE, prNumber: 1 })).rejects.toThrow(/base[\s\S]*sha/);
  });

  it('refuses an issue without its state, naming the field', async () => {
    await expect(readIssue(answering({ labels: [] }), { ...WHERE, number: 7 })).rejects.toThrow(/state/);
  });

  it('refuses an event whose data lacks the pull request number, naming the field', () => {
    const data = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', headSha: 'h1' };
    expect(() => CheckRequestDataSchema.parse(data)).toThrow(/prNumber/);
  });

  it('reads a failed request\'s status and message, and nothing from a value that carries none', () => {
    const failure = Object.assign(new Error('Not Found'), { status: 404 });
    expect(statusOf(failure)).toBe(404);
    expect(messageOf(failure)).toBe('Not Found');
    expect(statusOf('down')).toBeUndefined();
    expect(messageOf('down')).toBe('down');
  });
});
