import { execSync } from 'node:child_process';

import {
  getRepoRoot,
  loadAlignedReleasePackages,
} from './release-public-packages.mjs';

const repoRoot = getRepoRoot();
const configs = loadAlignedReleasePackages().map((pkg) => pkg.tsconfigPath);

execSync(`npx tsc --build ${configs.map((p) => JSON.stringify(p)).join(' ')}`, {
  cwd: repoRoot,
  stdio: 'inherit',
});
