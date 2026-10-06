import { describe, expect, it } from 'vitest';
import { parsePitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import {
  acceptOf, ASSET_MAX_BYTES, assetNameOf, COULD_NOT_UPLOAD, databaseAssets, demoAssets, fileRefusalOf, NOT_MEMBER, type AssetBucket, type AssetFile,
} from './pitch-form-assets';

// A product's files (PRD 1108 s2): a logo, a font and a track, each checked in the page, then sent into
// the `pitch-assets` bucket at `<workspace>/<product>/<name>` as the signed-in person (stubbed: no test
// calls Supabase), whose policies refuse anyone outside the product's workspace.

const fileOf = (name: string, size = 3): AssetFile => new File(['x'.repeat(size)], name);

type Answer = { error: { message: string; statusCode?: string } | null } | Error;

function bucket(answer: Answer = { error: null }) {
  const calls: unknown[] = [];
  const b: AssetBucket = {
    upload(path, _file, options) {
      calls.push([path, options]);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  return { calls, bucket: b };
}

describe('a file\'s name and kind', () => {
  it('keeps letters, digits, dot, dash and underscore, and its extension, lower case', () => {
    expect(assetNameOf('logo.svg')).toBe('logo.svg');
    expect(assetNameOf('Our Brand (bold) v2.WOFF2')).toBe('Our-Brand-bold-v2.woff2');
    expect(assetNameOf('../../etc/passwd.png')).toBe('etc-passwd.png');
    expect(assetNameOf('éé.mp3')).toBe('file.mp3');
    expect(assetNameOf(`${'a'.repeat(300)}.png`)).toHaveLength(114);
  });

  it('is a name the settings take as a file of the product', () => {
    const asset = `asset:${assetNameOf(`${'a b/'.repeat(80)}.png`)}`;
    expect(parsePitchSettings({ look: { logo: asset } }).ok).toBe(true);
  });

  it('is an image for the logo, a font for a font and a track for the music', () => {
    expect(acceptOf('logo')).toBe('.svg,.png,.jpg,.jpeg,.webp');
    expect(acceptOf('heading')).toBe('.woff2,.woff,.ttf,.otf');
    expect(acceptOf('text')).toBe(acceptOf('heading'));
    expect(acceptOf('music')).toBe('.mp3,.wav,.ogg');
    expect(fileRefusalOf('logo', { name: 'logo.PNG', size: 10 })).toBeNull();
    expect(fileRefusalOf('logo', { name: 'font.woff2', size: 10 })).toBe('Choose a .svg, .png, .jpg, .jpeg, .webp file.');
    expect(fileRefusalOf('music', { name: 'noext', size: 10 })).toBe('Choose a .mp3, .wav, .ogg file.');
  });

  it('is at most 20 MB, and not empty', () => {
    expect(fileRefusalOf('logo', { name: 'logo.png', size: ASSET_MAX_BYTES })).toBeNull();
    expect(fileRefusalOf('logo', { name: 'logo.png', size: ASSET_MAX_BYTES + 1 })).toBe('That file is over 20 MB.');
    expect(fileRefusalOf('logo', { name: 'logo.png', size: 0 })).toBe('That file is empty.');
  });
});

describe('an upload', () => {
  it('sends the file to its product\'s folder, replacing one of the same name, and answers its reference', async () => {
    const b = bucket();
    expect(await databaseAssets(b.bucket, 'ws-1', 'p-1').upload('heading', fileOf('Brand Bold.woff2'))).toEqual({ ok: true, asset: 'asset:Brand-Bold.woff2' });
    expect(await databaseAssets(b.bucket, 'ws-1', 'p-1').upload('logo', fileOf('logo.svg'))).toEqual({ ok: true, asset: 'asset:logo.svg' });
    expect(await databaseAssets(b.bucket, 'ws-1', 'p-1').upload('music', fileOf('theme.mp3'))).toEqual({ ok: true, asset: 'asset:theme.mp3' });
    expect(b.calls).toEqual([
      ['ws-1/p-1/Brand-Bold.woff2', { contentType: 'font/woff2', upsert: true }],
      ['ws-1/p-1/logo.svg', { contentType: 'image/svg+xml', upsert: true }],
      ['ws-1/p-1/theme.mp3', { contentType: 'audio/mpeg', upsert: true }],
    ]);
  });

  it('sends nothing for a file of the wrong kind', async () => {
    const b = bucket();
    expect(await databaseAssets(b.bucket, 'ws-1', 'p-1').upload('logo', fileOf('theme.mp3'))).toEqual({ ok: false, message: 'Choose a .svg, .png, .jpg, .jpeg, .webp file.' });
    expect(b.calls).toEqual([]);
  });

  it('is refused for someone outside the product\'s workspace', async () => {
    const policy = bucket({ error: { message: 'new row violates row-level security policy', statusCode: '403' } });
    expect(await databaseAssets(policy.bucket, 'ws-2', 'p-1').upload('logo', fileOf('logo.svg'))).toEqual({ ok: false, message: NOT_MEMBER });
    const unauthorized = bucket({ error: { message: 'Unauthorized' } });
    expect(await databaseAssets(unauthorized.bucket, 'ws-2', 'p-1').upload('logo', fileOf('logo.svg'))).toEqual({ ok: false, message: NOT_MEMBER });
  });

  it('says it could not upload when the bucket fails or the network does', async () => {
    expect(await databaseAssets(bucket({ error: { message: 'down', statusCode: '500' } }).bucket, 'ws-1', 'p-1').upload('logo', fileOf('logo.svg'))).toEqual({ ok: false, message: COULD_NOT_UPLOAD });
    expect(await databaseAssets(bucket(new Error('offline')).bucket, 'ws-1', 'p-1').upload('logo', fileOf('logo.svg'))).toEqual({ ok: false, message: COULD_NOT_UPLOAD });
  });

  it('in the demo, checks the file and keeps its name, sending nothing', async () => {
    expect(await demoAssets().upload('logo', fileOf('My logo.png'))).toEqual({ ok: true, asset: 'asset:My-logo.png' });
    expect(await demoAssets().upload('logo', fileOf('logo.png', 0))).toEqual({ ok: false, message: 'That file is empty.' });
  });
});
