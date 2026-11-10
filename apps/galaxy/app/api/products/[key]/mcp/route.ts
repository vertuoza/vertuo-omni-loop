import { handleProductMcp } from '../../../../../src/product-mcp/product-mcp.controller';
import { productMcpDeps } from '../../../../../src/product-mcp/product-mcp.live';

// /api/products/<key>/mcp: a product's knowledge over MCP, for an agent holding a workspace API key (PRD 2707
// s3), stateless Streamable HTTP with JSON answers (src/product-mcp/product-mcp.controller.ts). POST carries
// every call; GET and DELETE answer what a stateless server answers to them. It sits beside `knowledge`.
export const maxDuration = 60;

type Params = { params: Promise<{ key: string }> };

export async function POST(request: Request, { params }: Params) {
  return handleProductMcp(request, (await params).key, productMcpDeps());
}

export async function GET(request: Request, { params }: Params) {
  return handleProductMcp(request, (await params).key, productMcpDeps());
}

export async function DELETE(request: Request, { params }: Params) {
  return handleProductMcp(request, (await params).key, productMcpDeps());
}
