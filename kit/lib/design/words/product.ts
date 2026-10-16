// PRD 1795, s6: the words the product's glossary says to avoid, read from the local copy only
// (`.omni-loop/local/product-knowledge.json`, kept by `omni kb glossary`). Never the server: the
// words check stays offline. No copy, or one out of shape, adds nothing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { PRODUCT_KNOWLEDGE_FILE } from '../../product/knowledge.ts';

const CopySchema = z.object({ glossary: z.array(z.object({ term: z.string().min(1), avoid: z.array(z.string()) })) });

/** The product's avoided words, and for each (lower case) the term the product says in its place. */
export type ProductAvoids = { readonly words: readonly string[]; readonly says: ReadonlyMap<string, string> };

export function productAvoids(root: string): ProductAvoids {
  const says = new Map<string, string>();
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, PRODUCT_KNOWLEDGE_FILE), 'utf8'));
  } catch {
    return { words: [], says };
  }
  const copy = CopySchema.safeParse(value);
  if (!copy.success) return { words: [], says };
  for (const { term, avoid } of copy.data.glossary) {
    for (const word of avoid) {
      const key = word.trim().toLowerCase();
      if (key !== '' && !says.has(key)) says.set(key, term);
    }
  }
  return { words: [...says.keys()], says };
}
