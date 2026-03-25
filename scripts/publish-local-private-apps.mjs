import { execSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const registry = process.env.VERDACCIO_REGISTRY ?? 'http://localhost:4873/';

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.nx',
  'coverage',
  '.cache',
]);

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP_DIR_NAMES.has(name)) {
      continue;
    }
    if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example')) {
      continue;
    }
    const from = join(src, name);
    const to = join(dest, name);
    const st = statSync(from);
    if (st.isDirectory()) {
      copyTree(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

const privateAppDirs = ['demo', 'demo-api', 'starter'];

for (const dir of privateAppDirs) {
  const appRoot = join(root, 'apps', dir);
  const sourcePackagePath = join(appRoot, 'package.json');
  if (!existsSync(sourcePackagePath)) {
    throw new Error(`Missing ${sourcePackagePath}`);
  }
  const staging = mkdtempSync(join(tmpdir(), `continuum-local-publish-${dir}-`));
  try {
    copyTree(appRoot, staging);
    const packageJson = JSON.parse(readFileSync(join(staging, 'package.json'), 'utf8'));
    delete packageJson.private;
    delete packageJson.nx;
    delete packageJson.devDependencies;
    delete packageJson.scripts;
    writeFileSync(
      join(staging, 'package.json'),
      `${JSON.stringify(packageJson, null, 2)}\n`,
      'utf8'
    );
    writeFileSync(
      join(staging, '.npmignore'),
      ['node_modules/', 'dist/', '.nx/', 'coverage/', '.cache/', '.env', '.env.*', '!.env.example'].join('\n'),
      'utf8'
    );
    execSync(`npm publish --registry ${registry} --access public --tag next`, {
      cwd: staging,
      stdio: 'inherit',
      encoding: 'utf8',
    });
    process.stderr.write(`published private app ${dir}\n`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
