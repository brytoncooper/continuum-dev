import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAlignedReleasePackages } from './release-public-packages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const registry = process.env.VERDACCIO_REGISTRY ?? 'http://localhost:4873/';

try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const sha = execSync('git rev-parse --short HEAD', {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  process.stderr.write(`local publish: git ${branch} (${sha})\n`);
} catch {
  process.stderr.write(
    'local publish: git metadata unavailable (using current working tree only)\n'
  );
}

for (const pkg of loadAlignedReleasePackages()) {
  const cwd = pkg.distRoot;
  try {
    execSync(
      `npm publish --registry ${registry} --access public --tag next`,
      {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
    }
    );
    process.stderr.write(`published ${pkg.dir}\n`);
  } catch (e) {
    const combined = `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}`;
    if (
      combined.includes('previously published') ||
      combined.includes('already present')
    ) {
      process.stderr.write(`skip ${pkg.dir} (already on registry)\n`);
      continue;
    }
    throw e;
  }
}
