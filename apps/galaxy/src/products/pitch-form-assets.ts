import type { AssetTarget } from './pitch-form-model';

// The files a product's Pitch settings name (PRD 1108 s2): its logo, its fonts and its own track, sent
// straight from the browser into the private `pitch-assets` bucket of
// supabase/migrations/20261107090000_pitch_settings.sql, as the signed-in person. An object's path is
// `<workspace id>/<product id>/<name>`, and the bucket's policies let a member of that workspace upload
// it and nobody else, so whoever may edit Settings › Business uploads (any member, settled item s1-03)
// and a member of another workspace is refused. A file of the same name replaces the last one. The
// settings then name it `asset:<name>`, saved with the rest. In the demo, nothing leaves the page.

/** The bucket's own limit, 20 MB a file. */
export const ASSET_MAX_BYTES = 20 * 1024 * 1024;

const IMAGES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const FONTS = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
const TRACKS = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };

/** The files each target takes, by extension, with the type the bucket stores them under. */
const TYPES: Readonly<Record<AssetTarget, Readonly<Record<string, string>>>> = {
  logo: IMAGES,
  heading: FONTS,
  text: FONTS,
  music: TRACKS,
};

/** The file picker's `accept` for a target: its extensions. */
export const acceptOf = (target: AssetTarget): string => Object.keys(TYPES[target]).map((ext) => `.${ext}`).join(',');

const extensionOf = (name: string): string => /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';

/** A file's name as the bucket keeps it: letters, digits, dot, dash and underscore, at most 120. */
export function assetNameOf(fileName: string): string {
  const ext = extensionOf(fileName);
  const stem = fileName.slice(0, ext ? -(ext.length + 1) : undefined).replace(/[^\w.-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return `${(stem || 'file').slice(0, 110)}.${ext}`;
}

/** Why a file cannot go to a target, or null when it can. */
export function fileRefusalOf(target: AssetTarget, file: { name: string; size: number }): string | null {
  if (!(extensionOf(file.name) in TYPES[target])) return `Choose a ${acceptOf(target).replaceAll(',', ', ')} file.`;
  if (file.size > ASSET_MAX_BYTES) return 'That file is over 20 MB.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export const NOT_MEMBER = 'Only a member of this product’s workspace can upload its files.';
export const COULD_NOT_UPLOAD = 'Couldn’t upload this. Try again in a moment.';

export type Uploaded = { ok: true; asset: string } | { ok: false; message: string };

/** A file the page uploads: the browser's File meets it. */
export type AssetFile = Blob & { name: string; size: number };

/** The bucket, as the page's storage client reaches it (`storage.from('pitch-assets')`). */
export type AssetBucket = {
  upload(path: string, file: Blob, options: { contentType: string; upsert: true }): Promise<{ error: { message: string; statusCode?: string | undefined } | null }>;
};

export interface AssetsPort {
  upload(target: AssetTarget, file: AssetFile): Promise<Uploaded>;
}

export const PITCH_ASSETS_BUCKET = 'pitch-assets';

/** The bucket's refusal, as the page says it: its policies refuse anyone outside the workspace. */
function uploadRefusalOf(error: { message: string; statusCode?: string | undefined }): string {
  const refused = error.statusCode === '403' || /row-level security|unauthori[sz]ed/i.test(error.message);
  return refused ? NOT_MEMBER : COULD_NOT_UPLOAD;
}

/** A file checked and named, or why it was refused before anything was sent. */
function checked(target: AssetTarget, file: AssetFile): { ok: true; name: string; contentType: string } | { ok: false; message: string } {
  const refusal = fileRefusalOf(target, file);
  if (refusal) return { ok: false, message: refusal };
  const name = assetNameOf(file.name);
  return { ok: true, name, contentType: TYPES[target][extensionOf(name)] ?? 'application/octet-stream' };
}

export function databaseAssets(bucket: AssetBucket, workspace: string, product: string): AssetsPort {
  return {
    async upload(target, file) {
      const named = checked(target, file);
      if (!named.ok) return named;
      try {
        const { error } = await bucket.upload(`${workspace}/${product}/${named.name}`, file, { contentType: named.contentType, upsert: true });
        return error ? { ok: false, message: uploadRefusalOf(error) } : { ok: true, asset: `asset:${named.name}` };
      } catch {
        return { ok: false, message: COULD_NOT_UPLOAD };
      }
    },
  };
}

/** The same checks, and nothing sent: the demo's page keeps the name. */
export function demoAssets(): AssetsPort {
  return {
    upload(target, file) {
      const named = checked(target, file);
      return Promise.resolve(named.ok ? { ok: true, asset: `asset:${named.name}` } : named);
    },
  };
}
