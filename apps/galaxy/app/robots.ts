import type { MetadataRoute } from 'next';
import { robotsRules } from '../src/seo/seo';

// /robots.txt (PRD 983): the public pages allowed, the signed-in routes disallowed, the sitemap named
// on the site's one address. The rules are src/seo/seo.ts's.

export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
