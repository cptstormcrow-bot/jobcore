export type AppVersionInfo = { version: string; build: string | null };

export function formatVersionLabel(info: AppVersionInfo | null | undefined): string {
  if (!info || !info.version) return 'Version unknown';
  return info.build ? `Version ${info.version} (build ${info.build})` : `Version ${info.version}`;
}
