import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { productRepositoriesOf } from './repositories.repository';

// The Repositories section's storage (PRD 2419 s1): the two reads it sends as the signed-in person, each
// answer parsed where it comes in. A fake client records each query's chain and answers in order.

type Answer = { data: unknown; error: { message: string } | null };

function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const next = () => answers.shift() ?? { data: null, error: { message: 'no answer left' } };
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = next();
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  const db = { from: (table: string) => chain([`from(${JSON.stringify(table)})`]) } as unknown as Pick<SupabaseClient, 'from'>;
  return { db, lines };
}

const PRODUCT = { data: [{ plan_repository: 'acme/plan' }], error: null };
const LINKS = { data: [{ repository: 'acme/api' }, { repository: 'acme/web' }], error: null };

describe('the product’s repositories', () => {
  it('are its plan repository and its linked repositories, by name', async () => {
    const { db, lines } = fakeDb([PRODUCT, LINKS]);
    expect(await productRepositoriesOf(db, 'p-1')).toEqual({ plan: 'acme/plan', repositories: ['acme/api', 'acme/web'] });
    expect(lines).toEqual([
      'from("products").select("plan_repository").eq("id","p-1")',
      'from("product_repositories").select("repository").eq("product_id","p-1").order("repository")',
    ]);
  });

  it('are none when the caller reads no such product, a refusal or an answer out of shape', async () => {
    expect(await productRepositoriesOf(fakeDb([{ data: [], error: null }, LINKS]).db, 'p-1')).toBeNull();
    expect(await productRepositoriesOf(fakeDb([PRODUCT, { data: null, error: { message: 'down' } }]).db, 'p-1')).toBeNull();
    expect(await productRepositoriesOf(fakeDb([{ data: [{ plan_repository: 7 }], error: null }, LINKS]).db, 'p-1')).toBeNull();
  });
});
