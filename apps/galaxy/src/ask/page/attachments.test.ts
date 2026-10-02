import { describe, it, expect } from 'vitest';
import type { Shot } from '../answer-model';
import type { AskAttachments } from '../store';
import {
  imagesOf, newTray, progressOf, progressText, sendWithShots, stageShots, subscribeTrays, trayOf, type Bucket, type Progress,
} from './attachments';

// Send with screenshots (PRD 620): upload each, in order, then record the answer with their paths;
// a failed upload records nothing, and Send again uploads only what is missing; a round someone else
// answered first gets its uploads deleted. The storage client is a stub: no test reaches Supabase.

const ROUND = '0b7c6f0e-1111-4222-8333-944455556666';
const shot = (id: string, type = 'image/png'): Shot => ({ id, type, size: 10, file: new Blob([id], { type }) });

type Call = { op: 'upload'; path: string; contentType: string } | { op: 'remove'; paths: string[] };

function stubBucket(fail: (path: string, attempt: number) => { message: string; statusCode?: string } | null = () => null) {
  const calls: Call[] = [];
  const attempts = new Map<string, number>();
  const bucket: Bucket = {
    upload(path, _file, options) {
      calls.push({ op: 'upload', path, contentType: options.contentType });
      const attempt = (attempts.get(path) ?? 0) + 1;
      attempts.set(path, attempt);
      return Promise.resolve({ error: fail(path, attempt) });
    },
    remove(paths) {
      calls.push({ op: 'remove', paths });
      return Promise.resolve({ error: null });
    },
  };
  return { bucket, calls };
}

function recorder(outcome: 'answered' | 'taken' = 'answered') {
  const recorded: Array<AskAttachments | undefined> = [];
  const order: string[] = [];
  return {
    recorded,
    order,
    record: (attachments?: AskAttachments) => {
      recorded.push(attachments);
      order.push('record');
      return Promise.resolve(outcome);
    },
  };
}

describe('sending with screenshots', () => {
  it('uploads each screenshot under the round, in order, then records the answer with their paths', async () => {
    const { bucket, calls } = stubBucket();
    const tray = newTray();
    tray.shots = { 'Which one?': [shot('a'), shot('b', 'image/jpeg')], 'And this?': [shot('c', 'image/webp')] };
    const r = recorder();
    const seen: Progress[] = [];
    expect(await sendWithShots(bucket, ROUND, tray, r.record, (p) => seen.push(p))).toBe('answered');
    expect(calls).toEqual([
      { op: 'upload', path: `${ROUND}/1.png`, contentType: 'image/png' },
      { op: 'upload', path: `${ROUND}/2.jpg`, contentType: 'image/jpeg' },
      { op: 'upload', path: `${ROUND}/3.webp`, contentType: 'image/webp' },
    ]);
    expect(r.recorded).toEqual([{ 'Which one?': [`${ROUND}/1.png`, `${ROUND}/2.jpg`], 'And this?': [`${ROUND}/3.webp`] }]);
    expect(seen.map(progressText)).toEqual(['Uploading 1 of 3…', 'Uploading 2 of 3…', 'Uploading 3 of 3…', null]);
    expect(tray.uploaded.size).toBe(0);
  });

  it('records without attachments when there are no screenshots', async () => {
    const { bucket, calls } = stubBucket();
    const r = recorder();
    expect(await sendWithShots(bucket, ROUND, newTray(), r.record, () => {})).toBe('answered');
    expect(calls).toEqual([]);
    expect(r.recorded).toEqual([undefined]);
  });

  it('records nothing when an upload fails, and Send again uploads only what is missing', async () => {
    const { bucket, calls } = stubBucket((path, attempt) => (path.endsWith('/2.png') && attempt === 1 ? { message: 'network' } : null));
    const tray = newTray();
    tray.shots = { 'Which one?': [shot('a'), shot('b'), shot('c')] };
    const r = recorder();
    const seen: Progress[] = [];
    await expect(sendWithShots(bucket, ROUND, tray, r.record, (p) => seen.push(p))).rejects.toThrow('Could not upload 2 of 3 — Send again');
    expect(r.recorded).toEqual([]);
    expect(progressText(seen[seen.length - 1])).toBe('Could not upload 2 of 3 — Send again');

    calls.length = 0;
    expect(await sendWithShots(bucket, ROUND, tray, r.record, () => {})).toBe('answered');
    expect(calls).toEqual([
      { op: 'upload', path: `${ROUND}/2.png`, contentType: 'image/png' },
      { op: 'upload', path: `${ROUND}/3.png`, contentType: 'image/png' },
    ]);
    expect(r.recorded).toEqual([{ 'Which one?': [`${ROUND}/1.png`, `${ROUND}/2.png`, `${ROUND}/3.png`] }]);
  });

  it('keeps the uploads when recording fails, so Send again uploads nothing', async () => {
    const { bucket, calls } = stubBucket();
    const tray = newTray();
    tray.shots = { 'Which one?': [shot('a')] };
    await expect(sendWithShots(bucket, ROUND, tray, () => Promise.reject(new Error('offline')), () => {})).rejects.toThrow('offline');
    calls.length = 0;
    const r = recorder();
    expect(await sendWithShots(bucket, ROUND, tray, r.record, () => {})).toBe('answered');
    expect(calls).toEqual([]);
    expect(r.recorded).toEqual([{ 'Which one?': [`${ROUND}/1.png`] }]);
  });

  it('takes a file an earlier try stored without hearing back as uploaded', async () => {
    const { bucket } = stubBucket((_path, attempt) => (attempt === 1 ? { message: 'The resource already exists', statusCode: '409' } : null));
    const tray = newTray();
    tray.shots = { 'Which one?': [shot('a')] };
    const r = recorder();
    expect(await sendWithShots(bucket, ROUND, tray, r.record, () => {})).toBe('answered');
    expect(r.recorded).toEqual([{ 'Which one?': [`${ROUND}/1.png`] }]);
  });

  it('deletes a screenshot removed after it was uploaded, and gives its number to the next', async () => {
    const { bucket, calls } = stubBucket((path, attempt) => (path.endsWith('/2.png') && attempt === 1 ? { message: 'network' } : null));
    const tray = newTray();
    tray.shots = { 'Which one?': [shot('a'), shot('b')] };
    await expect(sendWithShots(bucket, ROUND, tray, recorder().record, () => {})).rejects.toThrow();
    tray.shots = { 'Which one?': [shot('b'), shot('c')] };
    calls.length = 0;
    const r = recorder();
    expect(await sendWithShots(bucket, ROUND, tray, r.record, () => {})).toBe('answered');
    expect(calls).toEqual([
      { op: 'remove', paths: [`${ROUND}/1.png`] },
      { op: 'upload', path: `${ROUND}/1.png`, contentType: 'image/png' },
      { op: 'upload', path: `${ROUND}/2.png`, contentType: 'image/png' },
    ]);
    expect(r.recorded).toEqual([{ 'Which one?': [`${ROUND}/1.png`, `${ROUND}/2.png`] }]);
  });

  it('deletes the uploads when the round was already answered', async () => {
    const { bucket, calls } = stubBucket();
    const tray = newTray();
    tray.shots = { 'Which one?': [shot('a'), shot('b')] };
    expect(await sendWithShots(bucket, ROUND, tray, recorder('taken').record, () => {})).toBe('taken');
    expect(calls[calls.length - 1]).toEqual({ op: 'remove', paths: [`${ROUND}/1.png`, `${ROUND}/2.png`] });
    expect(tray.uploaded.size).toBe(0);
  });
});

describe('the round trays the form stages', () => {
  it('holds each round\'s screenshots, and tells listeners when its progress moves', async () => {
    const heard: string[] = [];
    const stop = subscribeTrays(() => heard.push(progressText(progressOf('r-tray')) ?? 'idle'));
    stageShots('r-tray', { 'Which one?': [shot('a')] });
    expect(trayOf('r-tray').shots).toEqual({ 'Which one?': [shot('a')] });
    const { bucket } = stubBucket();
    await sendWithShots(bucket, ROUND, trayOf('r-tray'), recorder().record, (p) => {
      trayOf('r-tray').setProgress(p);
    });
    stop();
    expect(heard).toEqual(['Uploading 1 of 1…', 'idle']);
    expect(progressOf('never-staged')).toEqual({ kind: 'idle' });
  });
});

describe('what a paste or a drop carries', () => {
  it('keeps the files and nothing else', () => {
    const png = new File(['x'], 'shot.png', { type: 'image/png' });
    expect(imagesOf({ files: [png] as unknown as FileList })).toEqual([png]);
    expect(imagesOf({ files: [] as unknown as FileList })).toEqual([]);
    expect(imagesOf(null)).toEqual([]);
  });
});
