// `checkStoryboard()` (PRD 1108 s3, spec "The engine, the studio and the render"): the schema's
// refusals, a missing media file and a wrong scene order are errors, each named; word counts and reading
// time are warnings.
import { describe, expect, it } from 'vitest';
import { checkStoryboard } from './check.ts';
import { FIXTURE_MEDIA, REMOVED, changedStoryboard, fixtureStoryboard } from './storyboard.fixture.ts';

const allMedia = (file: string): boolean => FIXTURE_MEDIA.includes(file);
const check = (value: unknown, hasFile = allMedia) => checkStoryboard(value, { hasFile });
const lines = (findings: { path: string; message: string }[]) => findings.map(({ path, message }) => `${path}: ${message}`);

describe('checkStoryboard', () => {
  it('passes the fixture with no error and no warning, and gives its length', () => {
    const report = check(fixtureStoryboard());
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.seconds).toBe(26 - 5 * 0.5);
  });

  it('gives the schema’s refusals as errors, each at its path, and checks nothing further', () => {
    const report = check(changedStoryboard('scenes.2.media.camera.1.zoom', 5), () => false);
    expect(lines(report.errors)).toEqual(['scenes.2.media.camera.1.zoom: Too big: expected number to be <=4']);
  });

  it('names each missing media file at its path', () => {
    const report = check(fixtureStoryboard(), (file) => file !== 'shots/after.png');
    expect(lines(report.errors)).toEqual(['scenes.4.after.file: shots/after.png is missing']);
  });

  it('refuses a media file outside the run folder', () => {
    const report = check(changedStoryboard('scenes.2.media.file', '../secrets.webm'), () => true);
    expect(lines(report.errors)).toEqual(['scenes.2.media.file: ../secrets.webm is outside the run folder']);
    expect(lines(check(changedStoryboard('scenes.2.media.file', '/tmp/a.webm'), () => true).errors)).toEqual([
      'scenes.2.media.file: /tmp/a.webm is outside the run folder',
    ]);
  });

  it('refuses a clip that ends before it starts', () => {
    const report = check(changedStoryboard('scenes.2.media.end', 0.5));
    expect(lines(report.errors)).toEqual(['scenes.2.media.end: the clip ends at 0.5 s, before it starts at 1 s']);
  });

  it('names a missing outro', () => {
    const storyboard = fixtureStoryboard();
    storyboard.scenes.pop();
    expect(lines(check(storyboard).errors)).toEqual(['scenes: no outro: the last scene is the outro']);
  });

  it('names a missing intro', () => {
    const storyboard = fixtureStoryboard();
    storyboard.scenes.shift();
    delete storyboard.meta.music;
    expect(lines(check(storyboard).errors)).toEqual(['scenes: no intro: the first scene is the intro']);
  });

  it('names an intro that is not first and an outro that is not last', () => {
    const storyboard = fixtureStoryboard();
    delete storyboard.meta.music;
    storyboard.scenes.reverse();
    expect(lines(check(storyboard).errors)).toEqual([
      'scenes.0: an outro at scene 1: the outro is the last scene, and the only one',
      'scenes.5: an intro at scene 6: the intro is the first scene, and the only one',
    ]);
  });

  it('names a second intro', () => {
    const storyboard = fixtureStoryboard();
    const [intro] = storyboard.scenes;
    if (intro) storyboard.scenes.splice(1, 0, intro);
    expect(lines(check(storyboard).errors)).toContain('scenes.1: an intro at scene 2: the intro is the first scene, and the only one');
  });

  it('names a sync point past the last scene, or past its scene’s end', () => {
    expect(lines(check(changedStoryboard('meta.music.sync.scene', 6)).errors)).toEqual(['meta.music.sync.scene: no scene 7: the storyboard has 6']);
    expect(lines(check(changedStoryboard('meta.music.sync.at', 7)).errors)).toEqual(['meta.music.sync.at: 7 s is past the end of scene 3, 6 s long']);
  });

  it('reports every error together: a missing media file and a missing outro', () => {
    const storyboard = fixtureStoryboard();
    storyboard.scenes.pop();
    const report = check(storyboard, (file) => file !== 'clips/walk.webm');
    expect(lines(report.errors)).toEqual([
      'scenes.2.media.file: clips/walk.webm is missing',
      'scenes.3.media.file: clips/walk.webm is missing',
      'scenes: no outro: the last scene is the outro',
    ]);
  });

  it('warns on a title over 9 words, without an error', () => {
    const report = check(changedStoryboard('scenes.0.title', 'Quotes that send themselves the moment the last line is priced'));
    expect(report.errors).toEqual([]);
    expect(lines(report.warnings)).toContain('scenes.0.title: 11 words; a title holds at most 9');
  });

  it.each([
    ['scenes.1.text', 'A quote leaves the moment the last line is priced, signed online by the customer and paid within a day', 'scenes.1.text: 20 words; a statement holds at most 16'],
    ['scenes.2.bullets', ['One click sends the quote to the customer'], 'scenes.2.bullets.0: 8 words; a bullet holds at most 6'],
    ['scenes.3.steps.0.label', 'Price every line of the quote', 'scenes.3.steps.0.label: 6 words; a step holds at most 5'],
    ['scenes.5.cta', 'Available now to every customer on every plan', 'scenes.5.cta: 8 words; a call to action holds at most 5'],
    ['scenes.0.eyebrow', 'New this autumn in Widgets', 'scenes.0.eyebrow: 5 words; an eyebrow holds at most 4'],
  ])('warns on %s over its word count', (field, value, warning) => {
    expect(lines(check(changedStoryboard(field, value)).warnings)).toContain(warning);
  });

  it('warns when a scene’s words take longer to read than it lasts', () => {
    const report = check(changedStoryboard('scenes.1.duration', 1));
    expect(lines(report.warnings)).toEqual(['scenes.1: 10 words take about 4 s to read; the scene lasts 1 s']);
  });

  it('warns when the whole is outside 15 to 60 seconds', () => {
    const short = fixtureStoryboard();
    for (const scene of short.scenes) scene.duration = 2;
    short.scenes[1] = { type: 'statement', duration: 2, text: 'Quotes leave.' };
    expect(lines(check(short).warnings)).toContain('scenes: 9.5 s in all; a pitch lasts 15 to 60 s');
  });

  it('reads a scene with no words as nothing to read', () => {
    const report = check(changedStoryboard('scenes.4.labels', REMOVED));
    expect(report.warnings).toEqual([]);
  });
});
