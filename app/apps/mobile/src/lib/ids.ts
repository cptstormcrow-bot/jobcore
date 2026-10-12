import * as Crypto from 'expo-crypto';

/**
 * Shared id helpers. makeNonce replaces the 4 inline makeNonce copies
 * (field-tech-repos, admin-finance-repos, StartChecklist, Completion).
 */
export function newClientId(): string {
  return Crypto.randomUUID();
}

export function makeNonce(): string {
  return Crypto.randomUUID();
}
