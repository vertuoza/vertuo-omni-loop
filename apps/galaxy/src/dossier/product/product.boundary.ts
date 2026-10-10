import type { Boundary } from '../../data/parse-rows';
import { ProductDossierRow, ProductRow, productDossiers, workspaceProducts } from './product.repository';

// The Product picker's reads (PRD 1364 s7), for `pnpm schemas:verify`: the dossiers' rows and the
// products, as the picker's repository reads them.
export const boundaries: Boundary[] = [
  {
    name: 'dossier/product: dossiers',
    read: (db) => productDossiers(db).limit(20),
    schema: ProductDossierRow,
    shape: 'rows',
  },
  {
    name: 'dossier/product: products',
    read: (db) => workspaceProducts(db).limit(20),
    schema: ProductRow,
    shape: 'rows',
  },
];
