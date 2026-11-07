export type AppVersionInfo = { version: string; build: string | null };

/** `sep` goes between the version and the build; the Settings screen passes a newline so the build sits on its own line. */
export function formatVersionLabel(info: AppVersionInfo | null | undefined, sep = ' '): string {
  if (!info || !info.version) return 'Version unknown';
  return info.build ? `Version ${info.version}${sep}(build ${info.build})` : `Version ${info.version}`;
}
