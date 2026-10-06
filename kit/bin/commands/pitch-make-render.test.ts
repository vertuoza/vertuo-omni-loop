// `omni pitch render` and `omni pitch studio` on the fixture run, kit/test/fixtures/pitch/run (PRD 1108 s6,
// acceptance 5, 6, 8 and 10), through `main()`:
//
// - `render --stills` writes one image per scene and a contact sheet of them;
// - `render` writes pitch.mp4 (1920×1080, within the settings' length, with an audio track: the music is
//   FreePD's, from a faked archive), pitch-square.mp4 (1080×1080) and pitch.gif (at most 8 s, 640 px wide),
//   each read with ffprobe, and pitch.json records the track's licence;
// - `studio` serves the storyboard and reloads the page when it changes.
//
// The renders run in Playwright's Chromium with the computer's ffmpeg, where both are installed; elsewhere
// they skip, as the engine's own render tests do. The studio needs neither.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { main } from '../omni.ts';

const FIXTURE = fileURLToPath(new URL('../../test/fixtures/pitch/run/', import.meta.url));

const hasTool = (name: string): boolean => {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const browserHere = ((): boolean => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();
const toolsHere = browserHere && hasTool('ffmpeg') && hasTool('ffprobe');

/** A copy of the fixture run, its settings overlaid with `settings`. */
function fixtureRun(settings: Record<string, unknown> = {}): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'pitch-run-')), 'run');
  cpSync(FIXTURE, dir, { recursive: true });
  const current = z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')));
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ ...current, ...settings }));
  return dir;
}

/** An MP3 of a tone, made with ffmpeg, as the archive would answer one. */
function toneMp3(): Buffer {
  const file = join(mkdtempSync(join(tmpdir(), 'pitch-tone-')), 'tone.mp3');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=40', '-c:a', 'libmp3lame', '-b:a', '96k', file]);
  return readFileSync(file);
}

/** `omni pitch <args>` on the run `dir`, with the network answering archive.org with `mp3`. */
async function omni(args: string[], { dir, mp3, studioUntil }: { dir: string; mp3?: Buffer; studioUntil?: (url: string) => Promise<void> }) {
  const out: string[] = [];
  const err: string[] = [];
  const fetch = (url: string) => Promise.resolve(url.startsWith('https://archive.org/') && mp3 !== undefined ? new Response(new Uint8Array(mp3)) : new Response('', { status: 404 }));
  const code = await main(['pitch', ...args], {
    cwd: dir, env: {}, fetch, launch: () => chromium.launch(), openBrowser: () => undefined, studioUntil,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const ProbeSchema = z.object({
  streams: z.array(z.object({ codec_type: z.string(), width: z.number().optional(), height: z.number().optional() })),
  format: z.object({ duration: z.string().optional() }),
});

/** The size, length and stream kinds ffprobe reads of `file`. */
function probe(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const { streams, format } = ProbeSchema.parse(JSON.parse(out));
  const picture = streams.find((stream) => stream.codec_type === 'video');
  return { width: picture?.width, height: picture?.height, seconds: Number(format.duration), kinds: streams.map((stream) => stream.codec_type).sort() };
}


describe.skipIf(!toolsHere)('omni pitch render on the fixture run', () => {
  let dir = '';
  let mp3: Buffer = Buffer.alloc(0);

  beforeAll(() => {
    dir = fixtureRun({ music: { provider: 'freepd', mood: 'upbeat' } });
    mp3 = toneMp3();
  });

  it('--stills writes one image per scene and a contact sheet (acceptance 5)', async () => {
    const { code, out, err } = await omni(['render', '.', '--stills'], { dir, mp3 });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    const stills = ['01-intro', '02-feature', '03-beforeAfter', '04-outro'].map((name) => join(dir, 'stills', `${name}.png`));
    expect(out.split('\n').slice(0, 5)).toEqual([...stills, join(dir, 'stills/contact-sheet.png')]);
    for (const still of stills) expect(probe(still), still).toMatchObject({ width: 1920, height: 1080 });
    expect(probe(join(dir, 'stills/contact-sheet.png'))).toMatchObject({ width: 1920, height: 720 });
  });

  it('writes pitch.mp4, pitch-square.mp4 and pitch.gif in their shapes, the music under them, its licence in pitch.json (acceptance 6, 8)', async () => {
    const { code, out, err } = await omni(['render', '.'], { dir, mp3 });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toContain('15.5 s, music: freepd (CC0 1.0 Universal (public domain))');
    const wide = probe(join(dir, 'pitch.mp4'));
    expect(wide).toMatchObject({ width: 1920, height: 1080, kinds: ['audio', 'video'] });
    expect(wide.seconds).toBeGreaterThanOrEqual(15);
    expect(wide.seconds).toBeLessThanOrEqual(40);
    expect(probe(join(dir, 'pitch-square.mp4'))).toMatchObject({ width: 1080, height: 1080, kinds: ['audio', 'video'] });
    const gif = probe(join(dir, 'pitch.gif'));
    expect(gif).toMatchObject({ width: 640, kinds: ['video'] });
    expect(gif.seconds).toBeLessThanOrEqual(8.05);
    expect(probe(join(dir, 'slide.png'))).toMatchObject({ width: 1920, height: 1080 });
    expect(probe(join(dir, 'slide-square.png'))).toMatchObject({ width: 1080, height: 1080 });
    const pitch = z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(join(dir, 'pitch.json'), 'utf8')));
    expect(pitch['music']).toMatchObject({ provider: 'freepd', licence: 'CC0 1.0 Universal (public domain)' });
    expect(pitch['files']).toEqual(['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif']);
    expect(existsSync(join(dir, 'render'))).toBe(false);
  });
});

describe('omni pitch studio on the fixture run (acceptance 10)', () => {
  it('serves the storyboard, and reloads the page when it changes', async () => {
    const dir = fixtureRun();
    const seen: string[] = [];
    const { code, out } = await omni(['studio', '.'], {
      dir,
      studioUntil: async (url) => {
        const page = await fetch(url);
        seen.push(await page.text());
        const input = z.object({ storyboard: z.unknown() }).parse(await (await fetch(new URL('/run/input.json', url))).json());
        expect(input.storyboard).toEqual(JSON.parse(readFileSync(join(dir, 'storyboard.json'), 'utf8')));
        const reader = ((await fetch(new URL('/events', url))).body ?? new ReadableStream<Uint8Array>()).getReader();
        writeFileSync(join(dir, 'storyboard.json'), readFileSync(join(dir, 'storyboard.json'), 'utf8').replace('Available now', 'Out today'));
        let text = '';
        while (!text.includes('data: reload')) text += new TextDecoder().decode((await reader.read()).value);
        await reader.cancel();
        const reloaded = await (await fetch(new URL('/run/input.json', url))).text();
        seen.push(reloaded.includes('Out today') ? 'reloaded' : 'stale');
      },
    });
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/engine\/index\.html\?studio=&events=%2Fevents&input=%2Frun%2Finput\.json$/);
    expect(seen[0]).toContain('<script src="engine.js"></script>');
    expect(seen[1]).toBe('reloaded');
  });
});
