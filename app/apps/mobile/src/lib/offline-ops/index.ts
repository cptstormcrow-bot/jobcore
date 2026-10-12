// Offline op handler registry.
// W3 adds tech.ts / admin-jobs.ts / admin-people.ts / admin-finance.ts and imports them here for side-effect registration.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface OpContext {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  now(): Date;
}

export type OpHandler<P = unknown> = (payload: P, ctx: OpContext) => Promise<{ applied: true }>;

export class UnknownOpError extends Error {
  code = 'UNKNOWN_OP' as const;
  constructor(public op: string) {
    super(`Unknown offline op: ${op}`);
    this.name = 'UnknownOpError';
  }
}

export const OP_HANDLERS: Record<string, OpHandler<any>> = {};

export function registerOpHandler<P>(op: string, h: OpHandler<P>): void {
  OP_HANDLERS[op] = h as OpHandler<any>;
}

export function registerOpHandlers(map: Record<string, OpHandler<any>>): void {
  for (const k of Object.keys(map)) registerOpHandler(k, map[k]!);
}

export function getOpHandler(op: string): OpHandler<any> {
  const h = OP_HANDLERS[op];
  if (!h) throw new UnknownOpError(op);
  return h;
}

export function hasOpHandler(op: string): boolean {
  return op in OP_HANDLERS;
}
