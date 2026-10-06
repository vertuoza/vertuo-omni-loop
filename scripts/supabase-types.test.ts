// The database's types (PRD 725, s5): `supabase/database.types.ts` is what `supabase gen types
// --local` prints from the migrations, and `--check` fails when the committed file has drifted from
// it. `supabase` is a stub on PATH that prints a fixture: no test starts a database.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { drift } from './supabase-types.ts';

const script = join(dirname(fileURLToPath(import.meta.url)), 'supabase-types.ts');
const dirs: string[] = [];

afterEach(() => {
  for (let dir = dirs.pop(); dir; dir = dirs.pop()) rmSync(dir, { recursive: true, force: true });
});

// A slice of what the generator prints: one table with two columns.
const GENERATED = `export type Database = {
  public: {
    Tables: {
      fleets: {
        Row: {
          id: string
          name: string
        }
      }
    }
  }
}
`;
const MISSING_COLUMN = GENERATED.replace('          name: string\n', '');

function run(args: string[], { committed, generated, genExit = 0 }: { committed?: string; generated: string; genExit?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'supabase-types-'));
  dirs.push(dir);
  const out = join(dir, 'generated.ts');
  writeFileSync(out, generated);
  const stub = join(dir, 'supabase');
  writeFileSync(stub, `#!/usr/bin/env bash\necho "$@" > "${dir}/args"\n[ "${genExit}" = 0 ] || { echo "supabase: no database" >&2; exit ${genExit}; }\ncat "${out}"\n`);
  chmodSync(stub, 0o755);
  const file = join(dir, 'database.types.ts');
  if (committed !== undefined) writeFileSync(file, committed);
  const result = spawnSync(process.execPath, [script, '--file', file, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
  });
  const read = (name: string) => {
    try {
      return readFileSync(join(dir, name), 'utf8');
    } catch {
      return null;
    }
  };
  return { ...result, file: read('database.types.ts'), args: read('args') };
}

describe('drift', () => {
  it('is null when the committed types are what the migrations generate', () => {
    expect(drift(GENERATED, GENERATED)).toBeNull();
  });

  it('names the first line where a committed copy missing a column differs', () => {
    expect(drift(MISSING_COLUMN, GENERATED)).toBe('line 7: the committed file has "        }", the migrations generate "          name: string"');
  });

  it('names a committed file that ends early', () => {
    expect(drift(GENERATED.slice(0, GENERATED.indexOf('    }\n  }\n}')), GENERATED)).toMatch(/^line 10: the committed file ends, the migrations generate "    }"$/);
  });

  it('names a committed file that runs past what the migrations generate', () => {
    expect(drift(`${GENERATED}// extra\n`, GENERATED)).toBe('line 13: the committed file has "// extra", the migrations generate nothing more');
  });
});

describe('node scripts/supabase-types.ts', () => {
  it('writes what `supabase gen types --local` prints', () => {
    const r = run([], { generated: GENERATED });
    expect(r.status).toBe(0);
    expect(r.file).toBe(GENERATED);
    expect(r.args?.trim()).toBe('gen types --local');
  });

  it('passes --workdir through to the generator', () => {
    const r = run(['--workdir', '/tmp/elsewhere'], { generated: GENERATED });
    expect(r.status).toBe(0);
    expect(r.args?.trim()).toBe('gen types --local --workdir /tmp/elsewhere');
  });

  it('--check passes when the committed file is what the migrations generate', () => {
    const r = run(['--check'], { committed: GENERATED, generated: GENERATED });
    expect(r.status).toBe(0);
    expect(r.file).toBe(GENERATED);
  });

  it('--check fails on a committed copy missing one column, and leaves it as it is', () => {
    const r = run(['--check'], { committed: MISSING_COLUMN, generated: GENERATED });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('line 7');
    expect(r.stderr).toContain('node scripts/supabase-types.ts');
    expect(r.file).toBe(MISSING_COLUMN);
  });

  it('--check fails when there is no committed file', () => {
    const r = run(['--check'], { generated: GENERATED });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no committed types/);
  });

  it('fails, writing nothing, when the generator fails', () => {
    const r = run([], { generated: GENERATED, genExit: 1 });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('supabase: no database');
    expect(r.file).toBeNull();
  });

  it('refuses an unknown argument', () => {
    const r = run(['--nope'], { generated: GENERATED });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/usage:/);
  });
});
