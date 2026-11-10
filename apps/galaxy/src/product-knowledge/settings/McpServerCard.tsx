'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WriteSource } from '../constituents/knowledge-reader';
import { switchServer } from './mcp-port';
import {
  claudeCodeCommand, cursorEntry, KEYS_HREF, KEYS_LABEL, mcpUrl, MCP_TITLE, noKnowledgeLine, OFF_LINES, OFF_NOTE, ON_LINE, type McpCard,
} from './mcp-server';

// The MCP server card of Product settings (PRD 2707 s4; the draft screen product-knowledge-settings): whether
// agents may read the product's knowledge with the workspace's API keys, and where they connect. A workspace
// owner turns it on or off through product_mcp_set(), called as the signed-in person; any other member, and
// anyone on an archived product, only reads. In the demo the switch only moves the card.

interface Props {
  card: McpCard;
  product: string;
  source: WriteSource;
}

function CopyButton({ label, text }: { label: string; text: string }) {
  return (
    <button type="button" className="ask-button" onClick={() => { void navigator.clipboard.writeText(text); }}>{label}</button>
  );
}

export function McpServerCard({ card, product, source }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(card.on);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const url = mcpUrl(card.origin, card.key);
  const canSwitch = card.owner && !card.archived && card.key !== null;

  const flip = async () => {
    if (busy) return;
    setBusy(true);
    setRefused(false);
    const done = await switchServer(source, product, !on);
    setBusy(false);
    if (!done) { setRefused(true); return; }
    setOn(!on);
    router.refresh();
  };

  return (
    <section className="ask-card products-section" aria-labelledby="mcp-title" data-mcp={on ? 'on' : 'off'}>
      <h2 id="mcp-title">{MCP_TITLE}</h2>
      <p data-mcp-state>{on ? 'On' : 'Off'}</p>
      {on && url !== null && card.key !== null ? (
        <>
          <p className="ask-muted">{ON_LINE}</p>
          <p><code data-mcp-url>{url}</code></p>
          <span className="links-actions">
            <CopyButton label="Copy" text={url} />
            <CopyButton label="Copy for Claude Code" text={claudeCodeCommand(card.key, url)} />
            <CopyButton label="Copy for Cursor" text={cursorEntry(card.key, url)} />
          </span>
          <p className="ask-muted">Keys: <a href={KEYS_HREF}>{KEYS_LABEL}</a></p>
          {card.missing.map((repository) => <p key={repository} className="ask-muted" data-mcp-missing>{noKnowledgeLine(repository)}</p>)}
        </>
      ) : (
        OFF_LINES.map((line) => <p key={line} className="ask-muted">{line}</p>)
      )}
      {canSwitch ? (
        <>
          <span className="links-actions">
            <button type="button" className="ask-button" disabled={busy} onClick={() => { void flip(); }}>{on ? 'Turn off' : 'Turn on'}</button>
          </span>
          {on ? <p className="ask-muted">{OFF_NOTE}</p> : null}
        </>
      ) : null}
      {refused ? <p role="alert" className="ask-muted">Only a workspace owner can change this.</p> : null}
    </section>
  );
}
