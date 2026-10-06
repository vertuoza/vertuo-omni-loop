// The studio (PRD 1108 s6, acceptance 10): it serves the storyboard on the engine page with the player's
// keys and its event stream, writes the page's input again and reloads the page when the storyboard
// changes, and keeps the last good one, saying each error, when a change breaks it.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { contractNetwork, scratch } from './providers/fakes.ts';
import { openStudio } from './studio.ts';
import type { Studio } from './studio.ts';

const FIXTURE = fileURLToPath(new URL('../../test/fixtures/pitch/run/', import.meta.url));

function fixtureRun(): string {
  const dir = join(scratch('studio'), 'run');
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

/** The next message of an event stream, as its text. */
async function nextMessage(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  while (!text.includes('data:')) {
    const { value, done } = await reader.read();
    if (done) throw new Error('the event stream closed');
    text += decoder.decode(value);
  }
  return text;
}

const titleOf = (dir: string): unknown => (JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8')) as { storyboard: { scenes: { title?: string }[] } }).storyboard.scenes[0]?.title;

let studio: Studio | undefined;
afterEach(async () => {
  await studio?.close();
  studio = undefined;
});

describe('openStudio', () => {
  it("serves the storyboard on the engine page with the player's keys and the event stream", async () => {
    const dir = fixtureRun();
    studio = await openStudio(dir, { fetch: contractNetwork().fetch, warn: () => {} });
    expect(studio.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/engine\/index\.html\?studio=&events=%2Fevents&input=%2Frun%2Finput\.json$/);
    expect(await (await fetch(studio.url)).text()).toContain('<script src="engine.js"></script>');
    const input = (await (await fetch(new URL('/run/input.json', studio.url))).json()) as { storyboard: unknown };
    expect(input.storyboard).toEqual(JSON.parse(readFileSync(join(dir, 'storyboard.json'), 'utf8')));
  });

  it('reloads the page when the storyboard changes, with the new storyboard', async () => {
    const dir = fixtureRun();
    const reloads: number[] = [];
    studio = await openStudio(dir, { fetch: contractNetwork().fetch, warn: () => {}, onReload: () => reloads.push(1) });
    const stream = await fetch(new URL('/events', studio.url));
    const reader = (stream.body ?? new ReadableStream<Uint8Array>()).getReader();
    const storyboard = readFileSync(join(dir, 'storyboard.json'), 'utf8');
    writeFileSync(join(dir, 'storyboard.json'), storyboard.replace('Quotes that send themselves', 'Quotes on their way'));
    expect(await nextMessage(reader)).toContain('data: reload');
    expect(titleOf(dir)).toBe('Quotes on their way');
    expect(reloads).toEqual([1]);
    await reader.cancel();
  });

  it('keeps the last good storyboard and says each error when a change breaks it', async () => {
    const dir = fixtureRun();
    const lines: string[] = [];
    let broken: () => void = () => {};
    const said = new Promise<void>((done) => {
      broken = done;
    });
    studio = await openStudio(dir, { fetch: contractNetwork().fetch, warn: (line) => { lines.push(line); broken(); } });
    writeFileSync(join(dir, 'storyboard.json'), '{ "storyboard": 1 }');
    await said;
    expect(lines[0]).toMatch(/^error: /);
    expect(titleOf(dir)).toBe('Quotes that send themselves');
  });

  it('refuses to open a storyboard the check refuses', async () => {
    const dir = fixtureRun();
    writeFileSync(join(dir, 'storyboard.json'), '{ "storyboard": 1 }');
    const lines: string[] = [];
    await expect(openStudio(dir, { fetch: contractNetwork().fetch, warn: (line) => lines.push(line) })).rejects.toThrow('storyboard.json cannot be shown yet');
    expect(lines.length).toBeGreaterThan(0);
  });
});
