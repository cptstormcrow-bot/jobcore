// Online-only guard seam. Modules must not import from apps/mobile; the app layer injects
// the real guard (requireOnline from apps/mobile/src/lib/offline-mutations.ts) at port-build time.
// Default is a no-op so web and tests keep working.
let guard: (label: string) => void = () => {};

export function setOnlineGuard(fn: (label: string) => void): void {
  guard = fn;
}

export function requireOnline(label: string): void {
  guard(label);
}
