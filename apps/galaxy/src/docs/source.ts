import { docs } from '../../.source/server';
import { guideLoader } from './tree';

// The guide as the app serves it (PRD 346): the pages fumadocs-mdx compiled from docs/guide/ into
// .source/ (source.config.ts), through fumadocs-core's loader at /docs. Only the /docs routes import
// this file: .source/ is written by the build (and by `next dev`), and the tests read the markdown
// themselves (tree.test.ts).
export const guide = guideLoader(docs.toFumadocsSource());
