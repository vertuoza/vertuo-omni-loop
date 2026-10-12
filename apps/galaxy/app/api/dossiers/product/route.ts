// GET /api/dossiers/product?dossier=<id> → {product, products, locked}: what the PRD page's Product picker
// shows. POST /api/dossiers/product {dossier, product} → {product}: a member changes the PRD's product
// until an approval is in force (PRD 1364 s7, src/dossier/product/product.controller.ts).
export { getProduct as GET, postProduct as POST } from '../../../../src/dossier/product/product.controller';
