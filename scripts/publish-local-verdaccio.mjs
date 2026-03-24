import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dirs = JSON.parse(
  readFileSync(resolve(__dirname, 'release-public-package-dirs.json'), 'utf8')
);
const registry = process.env.VERDACCIO_REGISTRY ?? 'http://localhost:4873/';

for (const d of dirs) {
  const cwd = resolve(root, 'dist', 'packages', d);
  try {
    execSync(`npm publish --registry ${registry} --access public`, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    process.stderr.write(`published ${d}\n`);
  } catch (e) {
    const combined = `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}`;
    if (combined.includes('previously published')) {
      process.stderr.write(`skip ${d} (already on registry)\n`);
      continue;
    }
    throw e;
  }
}
