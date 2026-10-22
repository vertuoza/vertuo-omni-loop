// `checkStoryboard()` (PRD 1108 s3, spec "The engine, the studio and the render"): the schema's
// refusals, a missing media file and a wrong scene order are errors, each named; word counts and reading
// time are warnings. A scene's eyebrow and body (PRD 2030 s3) are held to their word counts and read in
// its reading time. A step's own media is checked as a scene's, a `wipeAt` that leaves the wipe no time
// is an error, and a step's body is held to 12 words (PRD 2030 s4). A stats scene's figure without its
// source is refused, and its labels are held to four words and read in its reading time (PRD 2030 s5).
// The music's sync names its scene by id, an unknown one refused; an index still reads, with a warning
// (PRD 2038 s2).
import { describe, expect, it } from 'vitest';
import { checkStoryboard } from './check.ts';
import { FIXTURE_MEDIA, REMOVED, changedStoryboard, changedStoryboardAt, fixtureStoryboard } from './storyboard.fixture.ts';

const allMedia = (file: string): boolean => FIXTURE_MEDIA.includes(file);
const check = (value: unknown, hasFile = allMedia) => checkStoryboard(value, { hasFile });
const lines = (findings: { path: string; message: string }[]) => findings.map(({ path, message }) => `${path}: ${message}`);

describe('checkStoryboard', () => {
  it('passes the fixture with no error and no warning, and gives its length', () => {
    const report = check(fixtureStoryboard());
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.seconds).toBe(31 - 6 * 0.5);
  });

  it('gives the schema’s refusals as errors, each at its path, and checks nothing further', () => {
    const report = check(changedStoryboard('scenes.2.media.camera.1.zoom', 5), () => false);
    expect(lines(report.errors)).toEqual(['scenes.2.media.camera.1.zoom: Too big: expected number to be <=4']);
  });

  it('names each missing media file at its path', () => {
    const report = check(fixtureStoryboard(), (file) => file !== 'shots/after.png');
    expect(lines(report.errors)).toEqual(['scenes.4.after.file: shots/after.png is missing']);
  });

  it('names a step’s missing media file at its path', () => {
    const report = check(changedStoryboard('scenes.3.steps.1.media.file', 'clips/send.webm'));
    expect(lines(report.errors)).toEqual(['scenes.3.steps.1.media.file: clips/send.webm is missing']);
  });

  it('checks a step’s media as a scene’s: outside the run folder, or a clip ending before it starts', () => {
    expect(lines(check(changedStoryboard('scenes.3.steps.1.media.file', '../walk.webm'), () => true).errors)).toEqual(['scenes.3.steps.1.media.file: ../walk.webm is outside the run folder']);
    expect(lines(check(changedStoryboard('scenes.3.steps.1.media.end', 9)).errors)).toEqual(['scenes.3.steps.1.media.end: the clip ends at 9 s, before it starts at 10 s']);
  });

  it('refuses a wipe that starts too late to finish before its scene ends', () => {
    expect(lines(check(changedStoryboard('scenes.4.wipeAt', 2.8)).errors)).toEqual(['scenes.4.wipeAt: the wipe starts at 2.8 s and takes 1.4 s; the scene ends at 4 s']);
    expect(lines(check(changedStoryboard('scenes.4.wipeAt', 9)).errors)).toEqual(['scenes.4.wipeAt: the wipe starts at 9 s and takes 1.4 s; the scene ends at 4 s']);
  });

  it('passes a wipe that finishes as its scene ends, or before', () => {
    expect(check(changedStoryboard('scenes.4.wipeAt', 2.6)).errors).toEqual([]);
    expect(check(changedStoryboard('scenes.4.wipeAt', 1.8)).errors).toEqual([]);
    expect(check(changedStoryboard('scenes.4.wipeAt', 0)).errors).toEqual([]);
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
      'scenes.6: an intro at scene 7: the intro is the first scene, and the only one',
    ]);
  });

  it('names a second intro', () => {
    const storyboard = fixtureStoryboard();
    const [intro] = storyboard.scenes;
    if (intro) storyboard.scenes.splice(1, 0, intro);
    expect(lines(check(storyboard).errors)).toContain('scenes.1: an intro at scene 2: the intro is the first scene, and the only one');
  });

  it('names a sync point past the last scene, or past its scene’s end', () => {
    expect(lines(check(changedStoryboard('meta.music.sync.scene', 7)).errors)).toEqual(['meta.music.sync.scene: no scene 8: the storyboard has 7']);
    expect(lines(check(changedStoryboard('meta.music.sync.at', 7)).errors)).toEqual(['meta.music.sync.at: 7 s is past the end of scene 3 (send), 6 s long']);
    const byIndex = changedStoryboardAt(changedStoryboard('scenes.2.id', REMOVED), 'meta.music.sync', { scene: 2, at: 7 });
    expect(lines(check(byIndex).errors)).toEqual(['meta.music.sync.at: 7 s is past the end of scene 3, 6 s long']);
  });

  it('refuses a sync naming an id no scene has, naming the ids there are', () => {
    const report = check(changedStoryboard('meta.music.sync.scene', 'wipe'));
    expect(lines(report.errors)).toEqual(['meta.music.sync.scene: no scene has the id wipe; the ids are send']);
    expect(report.warnings).toEqual([]);
  });

  it('refuses a sync naming an id when no scene has one, saying how to give it', () => {
    const storyboard = changedStoryboardAt(changedStoryboard('scenes.2.id', REMOVED), 'meta.music.sync.scene', 'wipe');
    expect(lines(check(storyboard).errors)).toEqual(['meta.music.sync.scene: no scene has the id wipe; give that scene "id": "wipe"']);
  });

  it('finds the sync’s scene by its id, wherever it moved', () => {
    const value = changedStoryboardAt(changedStoryboardAt(changedStoryboard('scenes.2.id', REMOVED), 'scenes.4.id', 'wipe'), 'meta.music.sync', { scene: 'wipe', at: 1, cue: 14 });
    expect(check(value)).toMatchObject({ errors: [], warnings: [] });
    expect(lines(check(changedStoryboardAt(value, 'meta.music.sync.at', 5)).errors)).toEqual(['meta.music.sync.at: 5 s is past the end of scene 5 (wipe), 4 s long']);
  });

  it('warns on a sync naming its scene by index, without an error', () => {
    const report = check(changedStoryboard('meta.music.sync.scene', 2));
    expect(report.errors).toEqual([]);
    expect(lines(report.warnings)).toEqual(['meta.music.sync.scene: scene 3 is named by its place: name the scene by its id, so a scene added before it does not move the music']);
  });

  it('warns on an index past the last scene too, beside its error', () => {
    const report = check(changedStoryboard('meta.music.sync.scene', 7));
    expect(lines(report.warnings)).toEqual(['meta.music.sync.scene: scene 8 is named by its place: name the scene by its id, so a scene added before it does not move the music']);
  });

  it('passes music with a track and no sync', () => {
    expect(check(changedStoryboard('meta.music', { track: 'Funshine' }))).toMatchObject({ errors: [], warnings: [] });
  });

  it('reports every error together: a missing media file and a missing outro', () => {
    const storyboard = fixtureStoryboard();
    storyboard.scenes.pop();
    const report = check(storyboard, (file) => file !== 'clips/walk.webm');
    expect(lines(report.errors)).toEqual([
      'scenes.2.media.file: clips/walk.webm is missing',
      'scenes.3.media.file: clips/walk.webm is missing',
      'scenes.3.steps.1.media.file: clips/walk.webm is missing',
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
    ['scenes.6.cta', 'Available now to every customer on every plan', 'scenes.6.cta: 8 words; a call to action holds at most 5'],
    ['scenes.5.items.0.label', 'Billed in one go each month', 'scenes.5.items.0.label: 6 words; a label holds at most 4'],
    ['scenes.0.eyebrow', 'New this autumn in Widgets', 'scenes.0.eyebrow: 5 words; an eyebrow holds at most 4'],
  ])('warns on %s over its word count', (field, value, warning) => {
    expect(lines(check(changedStoryboard(field, value)).warnings)).toContain(warning);
  });

  it.each([
    ['scenes.1.body'],
    ['scenes.2.body'],
    ['scenes.3.body'],
    ['scenes.4.body'],
    ['scenes.5.body'],
    ['scenes.6.body'],
  ])('warns on %s over 20 words, without an error', (field) => {
    const body = 'Every line of the quote is priced from the worksite, checked by the office and sent to the customer before the van leaves';
    const report = check(changedStoryboard(field, body));
    expect(report.errors).toEqual([]);
    expect(lines(report.warnings)).toContain(`${field}: 23 words; a body holds at most 20`);
  });

  it('warns on a step body over 12 words, without an error, and holds one of 12 to no count', () => {
    const report = check(changedStoryboard('scenes.3.steps.0.body', 'Each line takes its price from the catalogue, then the margin you set for it'));
    expect(report.errors).toEqual([]);
    expect(lines(report.warnings)).toContain('scenes.3.steps.0.body: 15 words; a step body holds at most 12');
    const twelve = check(changedStoryboard('scenes.3.steps.0.body', 'Each line takes its price from the catalogue, then your own margin')).warnings;
    expect(twelve.map(({ path }) => path)).not.toContain('scenes.3.steps.0.body');
  });

  it('counts a step’s body in its scene’s reading time', () => {
    const report = check(changedStoryboardAt(changedStoryboard('scenes.3.duration', 1), 'scenes.3.steps.0.body', 'Priced from the catalogue'));
    expect(lines(report.warnings)).toContain('scenes.3: 10 words take about 4 s to read; the scene lasts 1 s');
  });

  it('holds a callout label of a step’s media to its word count', () => {
    expect(lines(check(changedStoryboardAt(fixtureStoryboard(), 'scenes.3.steps.1.media.callouts', [{ at: 1, kind: 'ring', box: { x: 0, y: 0, w: 0.1, h: 0.1 }, label: 'Send' }])).warnings)).toEqual([]);
  });

  it('holds a body of 20 words to no word count', () => {
    const body = 'Every line of the quote is priced from the worksite, checked by the office and sent before the van leaves';
    const warnings = check(changedStoryboard('scenes.2.body', body)).warnings;
    expect(warnings.map(({ path }) => path)).not.toContain('scenes.2.body');
  });

  it('warns on an eyebrow over its word count on any scene that takes one', () => {
    expect(lines(check(changedStoryboard('scenes.3.eyebrow', 'Three steps from the worksite')).warnings)).toContain('scenes.3.eyebrow: 5 words; an eyebrow holds at most 4');
  });

  it('counts the eyebrow and the body in a scene’s reading time', () => {
    const storyboard = fixtureStoryboard();
    const scenes: unknown[] = storyboard.scenes.map((scene, n) => (n === 1 ? { ...scene, eyebrow: 'New in Widgets', body: 'Signed online by the customer, paid within the day.' } : scene));
    expect(lines(check({ ...storyboard, scenes }).warnings)).toEqual(['scenes.1: 22 words take about 8 s to read; the scene lasts 4 s']);
  });

  it('warns when a scene’s words take longer to read than it lasts', () => {
    const report = check(changedStoryboard('scenes.1.duration', 1));
    expect(lines(report.warnings)).toEqual(['scenes.1: 10 words take about 4 s to read; the scene lasts 1 s']);
  });

  it('warns when the whole is outside 15 to 60 seconds', () => {
    const short = fixtureStoryboard();
    for (const scene of short.scenes) scene.duration = 2;
    short.scenes[1] = { type: 'statement', duration: 2, text: 'Quotes leave.' };
    expect(lines(check(short).warnings)).toContain('scenes: 11 s in all; a pitch lasts 15 to 60 s');
  });

  it.each([['scenes.0.title'], ['scenes.1.text'], ['scenes.2.title'], ['scenes.3.title'], ['scenes.4.title'], ['scenes.5.title'], ['scenes.6.closing']])(
    'refuses an accent left open in %s, naming the field',
    (field) => {
      const report = check(changedStoryboard(field, 'Straight from the **worksite.'));
      expect(lines(report.errors)).toEqual([`${field}: an accent is left open: close it with another **`]);
      expect(report.warnings).toEqual([]);
    },
  );

  it('refuses an accent left open after a closed one, and warns on nothing then', () => {
    const report = check(changedStoryboard('scenes.2.title', 'Send **one** quote, **paid'));
    expect(lines(report.errors)).toEqual(['scenes.2.title: an accent is left open: close it with another **']);
    expect(report.warnings).toEqual([]);
  });

  it('passes a title with one accent, of one word or a few', () => {
    expect(check(changedStoryboard('scenes.2.title', 'Three clicks, **one invoice**.'))).toMatchObject({ errors: [], warnings: [] });
  });

  it.each([['scenes.0.title'], ['scenes.1.text'], ['scenes.5.title'], ['scenes.6.closing']])('warns on two accents in %s, without an error', (field) => {
    const report = check(changedStoryboard(field, 'Send **one**, get **paid**.'));
    expect(report.errors).toEqual([]);
    expect(lines(report.warnings)).toEqual([`${field}: 2 accents; a title holds one`]);
  });

  it('leaves the accent markers out of a word count, and holds no other field to the accent', () => {
    expect(check(changedStoryboard('scenes.3.steps.0.label', 'Price ** every line, then ** send')).warnings).toEqual([]);
    expect(check(changedStoryboard('scenes.3.steps.0.label', 'Price **every line')).errors).toEqual([]);
  });

  it('refuses a figure without its source, naming it, and checks nothing further', () => {
    const report = check(changedStoryboard('scenes.5.items.0.source', REMOVED));
    expect(lines(report.errors)).toEqual(['scenes.5.items.0.source: where the figure came from: spec, release or asked']);
    expect(report.warnings).toEqual([]);
  });

  it('counts the figures’ labels in the stats scene’s reading time, not their values', () => {
    const report = check(changedStoryboard('scenes.5.duration', 1));
    expect(lines(report.warnings)).toEqual(['scenes.5: 14 words take about 5 s to read; the scene lasts 1 s']);
  });

  it('reads a scene with no words as nothing to read', () => {
    const report = check(changedStoryboard('scenes.4.labels', REMOVED));
    expect(report.warnings).toEqual([]);
  });
});
