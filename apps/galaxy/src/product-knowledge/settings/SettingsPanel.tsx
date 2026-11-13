import { memberSession } from '../../data/member-session';
import { BusinessPage } from '../../business/BusinessPage';
import { DEMO_CLAIMS, DEMO_PRODUCTS } from '../../business/BusinessScreen';
import { loadBusinessPage } from '../../business/load';
import { Section } from '../KnowledgeLists';
import { Unreadable } from '../constituents/Unreadable';
import { McpServerCard } from './McpServerCard';
import { ProductKeyCard } from './ProductKeyCard';
import { loadMcpCard } from './mcp-server-load';

// The Settings section of the Knowledge home (PRD 2240 s6): what Settings › Business held per product,
// moved whole (BusinessPage.tsx, part `settings`): Region, marked shared by every product, the picks, the
// claim lists, To check and the draft from repos. Read as the signed-in person, so row-level security
// decides what the read returns; the writes are the claim functions as the same person. In the demo, its
// in-memory business.

const SETTINGS_LEDE = 'Region is shared by every product: a change here changes it for all. The rest is this product’s.';

export function SettingsPanel({ id }: { id: string }) {
  return (
    <>
      <p className="ask-muted">{SETTINGS_LEDE}</p>
      <Settings id={id} />
      <ProductKeyAndMcp id={id} />
    </>
  );
}

async function Settings({ id }: { id: string }) {
  const session = await memberSession();
  if (session.kind === 'demo') return <BusinessPage part="settings" current={id} source={{ kind: 'demo' }} claims={DEMO_CLAIMS} products={DEMO_PRODUCTS} />;
  if (session.kind !== 'signed-in') return <Unavailable />;
  const load = await loadBusinessPage(session.db, session.user);
  if (load.kind !== 'business') return <Unavailable />;
  return (
    <BusinessPage
      part="settings" current={id}
      source={{ kind: 'database', ...session.env, workspace: load.workspace.id, product: id }}
      claims={load.claims} products={load.products} draft={load.draft} pages={load.pages}
    />
  );
}

async function ProductKeyAndMcp({ id }: { id: string }) {
  const read = await loadMcpCard(id);
  if (read === null) return null;
  const { card, name, source } = read;
  return (
    <>
      <ProductKeyCard card={{ name, key: card.key, owner: card.owner, archived: card.archived }} product={id} source={source} />
      <McpServerCard card={card} product={id} source={source} />
    </>
  );
}

function Unavailable() {
  return <Section id="settings-title" title="Settings" lede={SETTINGS_LEDE}><Unreadable what="settings" /></Section>;
}
