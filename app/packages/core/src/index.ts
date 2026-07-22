export type Role = 'owner' | 'admin' | 'tech' | 'sales';

/**
 * Mirrors the Supabase `organizations` table.
 * TS uses camelCase; the DB is snake_case — a later mapping layer bridges them.
 * `enabledModules` ↔ `enabled_modules`.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  enabledModules: string[];
  createdAt: string;
}

/**
 * Mirrors the Supabase `profiles` table.
 * `organizationId` ↔ `organization_id`, `fullName` ↔ `full_name`, `createdAt` ↔ `created_at`.
 */
export interface Profile {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
}
