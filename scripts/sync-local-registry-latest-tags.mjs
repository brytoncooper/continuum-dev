import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAlignedReleasePackages } from './release-public-packages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const registry = process.env.VERDACCIO_REGISTRY ?? 'http://localhost:4873/';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pointLatestAt(name, version) {
  execSync(`npm dist-tag add "${name}@${version}" latest --registry ${registry}`, {
    stdio: 'inherit',
    encoding: 'utf8',
  });
}

for (const pkg of loadAlignedReleasePackages()) {
  const manifest = loadJson(resolve(pkg.distRoot, 'package.json'));
  pointLatestAt(manifest.name, manifest.version);
}

const privateAppDirs = ['demo', 'demo-api', 'starter'];
for (const dir of privateAppDirs) {
  const manifest = loadJson(resolve(root, 'apps', dir, 'package.json'));
  pointLatestAt(manifest.name, manifest.version);
}
