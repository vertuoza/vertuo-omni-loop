import 'server-only';
import type { GraphPageDeps } from './graph-page.controller';
import { productGraphRepository } from '../product-graph.repository';
import { productGraphService } from '../product-graph.service';

// The graph page's real read (PRD 1798 s6): s3's reader on the signed-in person's own client, so row-level
// security decides which product, links, graphs and knowledge they read.

export const LIVE_GRAPH_PAGE: GraphPageDeps = {
  read: (session, product) => productGraphService(productGraphRepository(session.db)).graph({ id: product }),
};
