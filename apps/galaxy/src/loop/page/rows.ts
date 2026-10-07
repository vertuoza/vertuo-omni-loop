// The stored rows the Loop page reads (PRD 1139 s5), as the types of the schemas the store parses them
// with (../store.ts, s2's, read here and never changed).
import type { z } from 'zod';
import type { LoopRow as LoopRowSchema, PlanRow as PlanRowSchema, TickRow as TickRowSchema } from '../store';

export type LoopRow = z.infer<typeof LoopRowSchema>;
export type TickRow = z.infer<typeof TickRowSchema>;
export type PlanRow = z.infer<typeof PlanRowSchema>;
