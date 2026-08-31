// Metro configuré pour le monorepo pnpm.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Surveiller tout le monorepo (pour @fixit/shared)
config.watchFolders = [monorepoRoot];

// 2. Résoudre les modules depuis l'app puis la racine
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
