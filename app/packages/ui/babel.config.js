/** Babel config for @jobcore/ui jest runs (babel-jest). Root-only config: Metro (rooted at apps/mobile) does not load it. */
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
