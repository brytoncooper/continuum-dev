import { execSync } from 'node:child_process';

import {
  getRepoRoot,
  loadAlignedReleasePackages,
} from './release-public-packages.mjs';

const repoRoot = getRepoRoot();
const configs = loadAlignedReleasePackages().map((pkg) => pkg.tsconfigPath);

execSync('node packages/developer-documentation/scripts/generate-corpus.mjs', {
  cwd: repoRoot,
  stdio: 'inherit',
});

execSync(
  `npx tsc --build --force ${configs.map((p) => JSON.stringify(p)).join(' ')}`,
  {
    cwd: repoRoot,
    stdio: 'inherit',
  }
);
