const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
// Monorepo root (app/apps/mobile -> app/apps -> app).
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Standard Expo monorepo Metro setup: watch the whole workspace (so hoisted
// packages under the workspace-root node_modules are picked up) and tell the
// resolver to look in both the app-local and workspace-root node_modules
// directories. Without this, Metro can mis-resolve relative paths (such as
// the "expo-router/entry" main-field target hoisted to app/node_modules)
// against the wrong origin directory, producing
// "Unable to resolve module ./../../node_modules/expo-router/entry.js".
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Disable Metro's package "exports" field resolution. @supabase/supabase-js
// optionally pulls in @opentelemetry/api for tracing; that package's ESM
// build ships an "exports" map with subpaths (e.g. ./metrics/NoopMeter)
// that Metro's exports-field resolver cannot resolve on web, causing
// "Unable to resolve './metrics/NoopMeter'" bundling failures. Falling
// back to Metro's legacy main-field resolution avoids the failure.
config.resolver.unstable_enablePackageExports = false;

// Metro's watchFolders (above) covers the whole monorepo workspace root so
// hoisted packages are picked up, but that also puts native build output
// under the watcher: Android's CMake/Gradle intermediates (android/.cxx,
// android/build, android/app/build) and iOS's Pods/build directories. These
// can contain very large numbers of fast-changing/binary files during a
// native build, which has been a suspected cause of the Metro file watcher
// crashing outright (taking the whole dev server down) with no error trail.
// Exclude them from the watcher via resolver.blockList, merged with
// whatever default exclusions getDefaultConfig already set up so those
// aren't silently dropped.
const exclusionList = require('metro-config/src/defaults/exclusionList');
const nativeBuildArtifactExclusions = [
  /.*\/android\/\.cxx\/.*/,
  /.*\/android\/app\/build\/.*/,
  /.*\/android\/build\/.*/,
  /.*\/ios\/Pods\/.*/,
  /.*\/ios\/build\/.*/,
  /.*\/CMakeFiles\/.*/,
];
config.resolver.blockList = config.resolver.blockList
  ? exclusionList([config.resolver.blockList, ...nativeBuildArtifactExclusions])
  : exclusionList(nativeBuildArtifactExclusions);

// packages/core and packages/ui use TypeScript NodeNext/ESM-style relative
// imports that end in `.js` but resolve to `.ts`/`.tsx` source files on disk
// (e.g. `import './clocks.js'` -> clocks.ts). Metro's default resolver does
// not perform that extension swap and fails with "Unable to resolve module
// ./clocks.js". This resolveRequest override intercepts relative imports
// ending in .js/.jsx and retries them against .ts/.tsx before falling back
// to Metro's default resolution, so the TS source convention keeps working
// unmodified under Metro. Scoped to workspace-authored source only (the
// importing module's path must not contain node_modules) — otherwise this
// retry fires for every relative .js import inside third-party packages
// (date-fns, @react-navigation/*, scheduler, etc.), wasting a doomed
// resolution attempt plus a console.warn on every one of them across the
// whole dependency graph on every bundle/rebuild.
const { resolve: defaultResolve } = require('metro-resolver');

// The Android release build (Gradle -> react-native-gradle-plugin ->
// `expo export:embed`) computes the app's entry file as an absolute path
// (via `expo/scripts/resolveAppEntry`), which resolves to the hoisted
// `expo-router/entry.js` under the workspace-root node_modules. Metro's own
// internal relative-path resolution step then re-expresses that absolute
// path as a path relative to the WRONG origin directory (the workspace
// root `app/`, one level above the actual Metro project root
// `app/apps/mobile/`), producing a broken request such as
// "./../../node_modules/expo-router/entry.js" that resolves two levels too
// far up (into the parent of the workspace root, which has no
// node_modules at all). Intercept any request for expo-router's entry
// module - regardless of how many (wrong) leading "../" segments precede
// it - and resolve it directly against the known-correct hoisted location.
const expoRouterEntryPattern = /(^|[\\/])node_modules[\\/]expo-router[\\/]entry(\.[a-z]+)?$/i;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (expoRouterEntryPattern.test(moduleName)) {
    const absoluteEntry = path.resolve(workspaceRoot, 'node_modules', 'expo-router', 'entry.js');
    try {
      return defaultResolve(context, absoluteEntry, platform);
    } catch (e) {
      console.warn('[metro.config] expo-router entry redirect failed for', moduleName, '-', e.message);
    }
  }
  if (
    moduleName.startsWith('.') &&
    /\.jsx?$/.test(moduleName) &&
    !/[\\/]node_modules[\\/]/.test(context.originModulePath || '')
  ) {
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
