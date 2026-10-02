// The business tests' reads of JSON (PRD 976): a route's answer and the body a fake received are
// parsed as objects whose fields a test then checks, instead of read as `any`.
import { z } from 'zod';

const Fields = z.record(z.string(), z.unknown());

/** A route's JSON answer, as an object: the test fails when it is anything else. */
export async function answerOf(response: Response): Promise<Record<string, unknown>> {
  return Fields.parse(await response.json());
}

/** The JSON a fake was sent as a request body, as an object: the test fails on any other body. */
export function sentOf(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string') throw new Error(`expected a JSON text body, got ${typeof body}`);
  return Fields.parse(JSON.parse(body));
}
