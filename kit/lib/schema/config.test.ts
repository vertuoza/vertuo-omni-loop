import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Config } from '../types.ts';
import { ConfigSchema } from './config.ts';
import { KIT_MESSAGES } from './messages.ts';

const issues = (value: unknown) => ConfigSchema.safeParse(value, { error: KIT_MESSAGES }).error?.issues ?? [];

describe('ConfigSchema', () => {
  it('fills every section a file leaves out with its defaults', () => {
    const config = ConfigSchema.parse({ kit: 1 });
    expect(config.branches.feature).toBe('feat/{topic}');
    expect(config.limits).toEqual({ stallDays: 5, attempts: 3, claimStaleMinutes: 60, beforeAfterMaxBytes: 512000 });
    expect(config.acceptance).toEqual({ enabled: false, dir: null, pendingSuffix: null, run: null });
    expect(config.signature?.name).toBe('Omni-man');
    expect(config.plan).toBeUndefined();
    expectTypeOf(config).toEqualTypeOf<Config>();
  });

  it('fills the keys a section leaves out, and keeps the ones it sets', () => {
    expect(ConfigSchema.parse({ kit: 1, limits: { attempts: 5 } }).limits.attempts).toBe(5);
    expect(ConfigSchema.parse({ kit: 1, limits: { attempts: 5 } }).limits.stallDays).toBe(5);
    expect(ConfigSchema.parse({ kit: 1, signature: null }).signature).toBeNull();
  });

  it('refuses a wrong value, naming its field', () => {
    const [issue] = issues({ kit: 1, limits: { attempts: 'three' } });
    expect(issue?.path).toEqual(['limits', 'attempts']);
    expect(issue?.message).toBe('Expected number, received string');
  });

  it('refuses a key it does not name, naming the section', () => {
    const [issue] = issues({ kit: 1, branches: { trunk: 'main' } });
    expect(issue?.path).toEqual(['branches']);
    expect(issue?.code).toBe('unrecognized_keys');
  });

  it('refuses an acceptance switched on with no folder, naming acceptance.dir', () => {
    const [issue] = issues({ kit: 1, acceptance: { enabled: true } });
    expect(issue?.path).toEqual(['acceptance', 'dir']);
  });
});
