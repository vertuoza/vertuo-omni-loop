import { describe, expect, it } from 'vitest';
import { AskCallError } from '../ask/client.ts';
import { ProofReplyError, pushProof } from './push.ts';
import type { ProofClient } from './push.ts';
import type { ProofRun } from './run.ts';
import { assertDefined } from '../../test/assert.ts';
import { parsePrd } from '../ids.ts';

const RUN: ProofRun = {
  commit: 'abcdef1',
  url: 'https://preview.example',
  criteria: [{ text: 'It shows.', verdict: 'pass', video: '1.webm', script: '1.spec.ts' }],
  files: [
    { name: '1.webm', path: '/run/1.webm', bytes: 3, type: 'video/webm' },
    { name: '1.spec.ts', path: '/run/1.spec.ts', bytes: 4, type: 'text/plain' },
  ],
};
const LINKS = [
  { name: '1.webm', path: 'd/r-1/1.webm', url: 'https://files.example/1' },
  { name: '1.spec.ts', path: 'd/r-1/1.spec.ts', url: 'https://files.example/2' },
];
const TAB = 'https://omni.example/prd/d?tab=proof';

/** A client that answers each call with `over[name]` or the happy reply, recording every call in order. */
type Reply = (...args: never[]) => Promise<unknown>;

function fakeClient(over: Record<string, Reply> = {}) {
  const calls: [string, ...unknown[]][] = [];
  const replies: Record<string, Reply> = {
    requestProofUploads: () => Promise.resolve({ run: 'r-1', files: LINKS }),
    upload: () => Promise.resolve(undefined),
    registerProof: () => Promise.resolve({ url: TAB }),
    ...over,
  };
  const client = Object.fromEntries(Object.entries(replies).map(([name, reply]) => [name, (...args: never[]) => {
    calls.push([name, ...args]);
    return reply(...args);
  }])) as ProofClient;
  return { client, calls };
}
const read = (path: string) => new TextEncoder().encode(`bytes of ${path}`);

describe('pushProof', () => {
  it('asks for links, puts each file to its own, then registers the run and hands back the tab', async () => {
    const { client, calls } = fakeClient();
    expect(await pushProof({ client, repo: 'acme/widgets', prd: parsePrd(7), run: RUN, read })).toEqual({ tab: TAB });
    expect(calls).toEqual([
      ['requestProofUploads', { repo: 'acme/widgets', prd: 7, files: [{ name: '1.webm', bytes: 3, type: 'video/webm' }, { name: '1.spec.ts', bytes: 4, type: 'text/plain' }] }],
      ['upload', 'https://files.example/1', read('/run/1.webm'), 'video/webm'],
      ['upload', 'https://files.example/2', read('/run/1.spec.ts'), 'text/plain'],
      ['registerProof', { repo: 'acme/widgets', prd: 7, run: 'r-1', commit: 'abcdef1', url: 'https://preview.example', criteria: RUN.criteria }],
    ]);
  });

  it('a run that sent preview.gif also hands back the GIF\'s stable link, on the tab\'s origin', async () => {
    const { client } = fakeClient({
      requestProofUploads: () => Promise.resolve({ run: 'r-1', files: [...LINKS, { name: 'preview.gif', path: 'd/r-1/preview.gif', url: 'https://files.example/3' }] }),
    });
    const withGif: ProofRun = { ...RUN, files: [...RUN.files, { name: 'preview.gif', path: '/run/preview.gif', bytes: 5, type: 'image/gif' }] };
    expect(await pushProof({ client, repo: 'acme/widgets', prd: parsePrd(7), run: withGif, read }))
      .toEqual({ tab: TAB, gif: 'https://omni.example/api/proofs/r-1/preview.gif' });
  });

  it('a run with no file asks for no link and registers straight away', async () => {
    const { client, calls } = fakeClient();
    const bare: ProofRun = { ...RUN, criteria: [{ text: 'A key.', verdict: 'unfilmable' }], files: [] };
    const runId = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
    // No upload call means no run id from the app: one is minted here.
    expect(await pushProof({ client, repo: 'acme/widgets', prd: parsePrd(7), run: bare, read, newRunId: () => runId })).toEqual({ tab: TAB });
    expect(calls.map(([name]) => name)).toEqual(['registerProof']);
    assertDefined(calls[0], 'calls[0]');
    expect((calls[0][1] as { run: string }).run).toBe(runId);
  });

  it('a refused call stops the push there, as the AskCallError it is', async () => {
    const refused = new AskCallError('POST /api/proofs/uploads: 404', { status: 404 });
    const { client, calls } = fakeClient({ requestProofUploads: () => Promise.reject(refused) });
    await expect(pushProof({ client, repo: 'acme/widgets', prd: parsePrd(7), run: RUN, read })).rejects.toBe(refused);
    expect(calls).toHaveLength(1);

    const upload = fakeClient({ upload: () => Promise.reject(new AskCallError('PUT: 400', { status: 400 })) });
    await expect(pushProof({ client: upload.client, repo: 'acme/widgets', prd: parsePrd(7), run: RUN, read })).rejects.toMatchObject({ status: 400 });
    expect(upload.calls.map(([name]) => name)).toEqual(['requestProofUploads', 'upload']);
  });

  it('a reply missing the run, a file\'s link or the tab is a ProofReplyError', async () => {
    const noRun = fakeClient({ requestProofUploads: () => Promise.resolve({ files: LINKS }) });
    await expect(pushProof({ client: noRun.client, repo: 'acme/widgets', prd: parsePrd(7), run: RUN, read })).rejects.toBeInstanceOf(ProofReplyError);
    const noLink = fakeClient({ requestProofUploads: () => Promise.resolve({ run: 'r-1', files: LINKS.slice(0, 1) }) });
    await expect(pushProof({ client: noLink.client, repo: 'acme/widgets', prd: parsePrd(7), run: RUN, read })).rejects.toThrow('no upload link for 1.spec.ts in the reply');
    expect(noLink.calls.map(([name]) => name)).toEqual(['requestProofUploads']);
    const noTab = fakeClient({ registerProof: () => Promise.resolve({}) });
    await expect(pushProof({ client: noTab.client, repo: 'acme/widgets', prd: parsePrd(7), run: RUN, read })).rejects.toThrow('no link in the reply');
  });
});
