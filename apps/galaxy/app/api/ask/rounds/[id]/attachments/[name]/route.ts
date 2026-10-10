import { addAttachment, removeAttachment } from '../../../../../../../src/ask/api';
import { askDeps } from '../../../../../../../src/ask/api-live';

// POST /api/ask/rounds/:id/attachments/:name <one screenshot, at most 4 MB> → {path}: the page uploads
// a screenshot of the answer it is about to send, one per request (PRD 1318, s3; PRD 620).
// DELETE /api/ask/rounds/:id/attachments/:name → {path, removed: true}: one it uploaded, then dropped
// (src/ask/api.ts).
export const maxDuration = 60;

type Params = { params: Promise<{ id: string; name: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id, name } = await params;
  return addAttachment(request, id, name, askDeps());
}

export async function DELETE(request: Request, { params }: Params) {
  const { id, name } = await params;
  return removeAttachment(request, id, name, askDeps());
}
