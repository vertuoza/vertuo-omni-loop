import { mcpDeps } from '../../../src/agent-connect/mcp/live';
import { handleMcp } from '../../../src/agent-connect/mcp/server';

// /api/mcp: the business over MCP for an editor's agent holding a read-only link (PRD 855 s2), stateless
// Streamable HTTP with JSON answers (src/agent-connect/mcp/server.ts). POST carries every call; GET and
// DELETE answer what a stateless server answers to them.
export const maxDuration = 60;

export function POST(request: Request) {
  return handleMcp(request, mcpDeps());
}

export function GET(request: Request) {
  return handleMcp(request, mcpDeps());
}

export function DELETE(request: Request) {
  return handleMcp(request, mcpDeps());
}
