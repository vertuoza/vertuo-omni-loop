/** Whether `value` is an object whose fields can be read by name: any non-null object, arrays included. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
