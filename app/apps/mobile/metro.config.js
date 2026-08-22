const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable Metro's package "exports" field resolution. @supabase/supabase-js
// optionally pulls in @opentelemetry/api for tracing; that package's ESM
// build ships an "exports" map with subpaths (e.g. ./metrics/NoopMeter)
// that Metro's exports-field resolver cannot resolve on web, causing
// "Unable to resolve './metrics/NoopMeter'" bundling failures. Falling
// back to Metro's legacy main-field resolution avoids the failure.
config.resolver.unstable_enablePackageExports = false;

// packages/core and packages/ui use TypeScript NodeNext/ESM-style relative
// imports that end in `.js` but resolve to `.ts`/`.tsx` source files on disk
// (e.g. `import './clocks.js'` -> clocks.ts). Metro's default resolver does
// not perform that extension swap and fails with "Unable to resolve module
// ./clocks.js". This resolveRequest override intercepts relative imports
// ending in .js/.jsx and retries them against .ts/.tsx before falling back
// to Metro's default resolution, so the TS source convention keeps working
// unmodified under Metro.
const { resolve: defaultResolve } = require('metro-resolver');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && /\.jsx?$/.test(moduleName)) {
    const tsCandidate = moduleName.replace(/\.jsx?$/, (m) => (m === '.jsx' ? '.tsx' : '.ts'));
    try {
      return defaultResolve(context, tsCandidate, platform);
    } catch (e) {
      console.warn('[metro.config] .ts retry failed for', tsCandidate, '-', e.message);
    }
  }
  return defaultResolve(context, moduleName, platform);
};

module.exports = config;
