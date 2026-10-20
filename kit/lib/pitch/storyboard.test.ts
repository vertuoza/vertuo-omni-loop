// The storyboard's schema (PRD 1108 s3): the fixture with all six scene types reads, and each malformed
// field is refused with its path. A scene's supporting lines (PRD 2030 s3): an eyebrow and a body on the
// statement, feature, steps and before/after, a body on the outro.
import { describe, expect, it } from 'vitest';
import { SCENE_TYPES, mediaOf, parseStoryboard } from './storyboard.ts';
import { REMOVED, changedStoryboard, fixtureStoryboard } from './storyboard.fixture.ts';

/** The fixture with the fields `fields` added to its scene `index`. */
function withFields(index: number, fields: Record<string, string>): unknown {
  const storyboard = fixtureStoryboard();
  const scenes: unknown[] = storyboard.scenes.map((scene, n) => (n === index ? { ...scene, ...fields } : scene));
  return { ...storyboard, scenes };
}

/** The paths a storyboard is refused at. */
const refusedAt = (value: unknown): string[] => (parseStoryboard(value).problems ?? []).map((problem) => problem.path);

describe('parseStoryboard', () => {
  it('reads the fixture, which holds all six scene types', () => {
    const { storyboard, problems } = parseStoryboard(fixtureStoryboard());
    expect(problems).toBeUndefined();
    expect(storyboard?.scenes.map((scene) => scene.type)).toEqual([...SCENE_TYPES]);
  });

  it.each([
    ['a version other than 1', 'storyboard', 2, 'storyboard'],
    ['an fps other than 30', 'meta.fps', 24, 'meta.fps'],
    ['a width other than 1920', 'meta.width', 1280, 'meta.width'],
    ['a height other than 1080', 'meta.height', 720, 'meta.height'],
    ['no sources', 'meta.sources', [], 'meta.sources'],
    ['a transition over 2 s', 'meta.transition', 3, 'meta.transition'],
    ['a sync point before the first scene', 'meta.music.sync.scene', -1, 'meta.music.sync.scene'],
    ['no scenes', 'scenes', [], 'scenes'],
    ['an unknown scene type', 'scenes.1.type', 'montage', 'scenes.1.type'],
    ['a scene under 1 s', 'scenes.0.duration', 0.5, 'scenes.0.duration'],
    ['a scene over 20 s', 'scenes.0.duration', 21, 'scenes.0.duration'],
    ['an intro with no title', 'scenes.0.title', REMOVED, 'scenes.0.title'],
    ['an empty statement', 'scenes.1.text', '  ', 'scenes.1.text'],
    ['five bullets', 'scenes.2.bullets', ['a', 'b', 'c', 'd', 'e'], 'scenes.2.bullets'],
    ['an unknown layout', 'scenes.2.layout', 'centre', 'scenes.2.layout'],
    ['a media of an unknown kind', 'scenes.2.media.kind', 'gif', 'scenes.2.media.kind'],
    ['a media with no file', 'scenes.2.media.file', REMOVED, 'scenes.2.media.file'],
    ['a zoom over 4', 'scenes.2.media.camera.1.zoom', 5, 'scenes.2.media.camera.1.zoom'],
    ['a zoom under 1', 'scenes.2.media.camera.0.zoom', 0.5, 'scenes.2.media.camera.0.zoom'],
    ['a focus outside the media', 'scenes.2.media.camera.1.focus.x', 1.2, 'scenes.2.media.camera.1.focus.x'],
    ['a callout of an unknown kind', 'scenes.2.media.callouts.0.kind', 'arrow', 'scenes.2.media.callouts.0.kind'],
    ['a callout label over four words', 'scenes.2.media.callouts.0.label', 'press this button right here', 'scenes.2.media.callouts.0.label'],
    ['a cursor outside the media', 'scenes.2.media.cursor.0.y', -0.1, 'scenes.2.media.cursor.0.y'],
    ['a crop outside the media', 'scenes.4.after.crop.h', 2, 'scenes.4.after.crop.h'],
    ['an unknown device', 'scenes.2.media.device', 'tv', 'scenes.2.media.device'],
    ['a rate of 0', 'scenes.2.media.rate', 0, 'scenes.2.media.rate'],
    ['one step', 'scenes.3.steps', [{ label: 'Only', at: 0 }], 'scenes.3.steps'],
    ['five steps', 'scenes.3.steps', [0, 1, 2, 3, 4].map((at) => ({ label: `Step ${at}`, at })), 'scenes.3.steps'],
    ['a before/after with no after', 'scenes.4.after', REMOVED, 'scenes.4.after'],
    ['an outro with no call to action', 'scenes.5.cta', REMOVED, 'scenes.5.cta'],
    ['a field the schema does not name', 'scenes.5.subtitle', 'x', 'scenes.5'],
    ['an empty body', 'scenes.2.body', ' ', 'scenes.2.body'],
    ['an empty eyebrow', 'scenes.3.eyebrow', '', 'scenes.3.eyebrow'],
    ['an eyebrow on the outro', 'scenes.5.eyebrow', 'Now', 'scenes.5'],
  ])('refuses %s, at its path', (_name, field, value, path) => {
    expect(refusedAt(changedStoryboard(field, value))).toContain(path);
  });

  it.each([
    ['a statement', 1],
    ['a feature', 2],
    ['steps', 3],
    ['a before/after', 4],
  ])('reads %s with an eyebrow and a body', (_name, index) => {
    const fields = { eyebrow: 'New in Widgets', body: 'Every line priced, the quote leaves on its own.' };
    const scene = parseStoryboard(withFields(index, fields)).storyboard?.scenes[index];
    expect(scene).toMatchObject(fields);
  });

  it('reads an outro with a body under its closing line', () => {
    const scene = parseStoryboard(withFields(5, { body: 'Live for every customer' })).storyboard?.scenes[5];
    expect(scene).toMatchObject({ type: 'outro', body: 'Live for every customer' });
  });

  it('names every refused field, not the first only', () => {
    const paths = refusedAt({ ...fixtureStoryboard(), storyboard: 2, scenes: [] });
    expect(paths).toEqual(expect.arrayContaining(['storyboard', 'scenes']));
  });

  it('refuses what is not an object, at the root', () => {
    expect(refusedAt('a storyboard')).toEqual(['']);
  });
});

describe('mediaOf', () => {
  it('lists each scene’s media with its path, and none for a scene without', () => {
    const { scenes } = fixtureStoryboard();
    expect(scenes.flatMap((scene, index) => mediaOf(scene, index).map(({ path, media }) => `${path}=${media.file}`))).toEqual([
      'scenes.2.media=clips/walk.webm',
      'scenes.3.media=clips/walk.webm',
      'scenes.4.before=shots/before.png',
      'scenes.4.after=shots/after.png',
    ]);
  });
});
