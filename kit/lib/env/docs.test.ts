import { describe, expect, it } from 'vitest';
import { envExampleNames, listDifference, readmeNames } from './docs.ts';

describe('the docs check, on fixtures', () => {
  it('reads every NAME= line of an .env.example, comments aside', () => {
    expect(envExampleNames('# NOT_THIS=1\nSUPABASE_URL=\n\nGITHUB_APP_ID=12\n# Optional: OTHER\nnpm_x=\n')).toEqual(['SUPABASE_URL', 'GITHUB_APP_ID', 'npm_x']);
  });

  it('reads the backticked names in a README\'s marked section only', () => {
    const readme = [
      'Set `OUTSIDE_NAME` first.',
      '<!-- omni:env-variables -->',
      '- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: the pair, read with `pnpm game:score`',
      '- `OPENROUTER_API_KEY`, optional (`VERCEL_ENV=production` is not a name), `SUPABASE_URL` again',
      '<!-- /omni:env-variables -->',
      'And `AFTER_NAME`.',
    ].join('\n');
    expect(readmeNames(readme)).toEqual(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY']);
  });

  it('refuses a README with no marked section, an unclosed one, or two', () => {
    expect(() => readmeNames('# Title\n`SUPABASE_URL`\n')).toThrow(/one <!-- omni:env-variables --> section/);
    expect(() => readmeNames('<!-- omni:env-variables -->\n`A_B`\n')).toThrow(/closed by <!-- \/omni:env-variables -->/);
    const twice = '<!-- omni:env-variables -->\n`A_B`\n<!-- /omni:env-variables -->\n<!-- omni:env-variables -->\n<!-- /omni:env-variables -->\n';
    expect(() => readmeNames(twice)).toThrow(/one <!-- omni:env-variables --> section/);
  });

  it('names a variable read but not listed, and one listed but not read', () => {
    expect(listDifference(['A_KEY', 'B_URL'], ['B_URL', 'C_SECRET'])).toEqual({ unlisted: ['A_KEY'], unread: ['C_SECRET'] });
    expect(listDifference(['A_KEY'], ['A_KEY'])).toEqual({ unlisted: [], unread: [] });
  });
});
