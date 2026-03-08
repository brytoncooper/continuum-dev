import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const packageNames = [
  'contract',
  'runtime',
  'session',
  'core',
  'react',
  'prompts',
  'ai-connect',
  'starter-kit',
];
const distRoots = packageNames.map((name) =>
  resolve(process.cwd(), 'dist', 'packages', name)
);

const forbiddenFilePatterns = [
  /\.spec\.[cm]?[jt]sx?$/i,
  /\.test\.[cm]?[jt]sx?$/i,
  /(^|\/)project\.json$/i,
  /(^|\/)vitest\.config\.[cm]?[jt]s$/i,
  /(^|\/)jest\.config\.[cm]?[jt]s$/i,
  /(^|\/)LIBRARY_DEEP_DIVE\.md$/i,
];

function run(command, cwd) {
  return execSync(command, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

function assertDistOutputsExist() {
  for (const distRoot of distRoots) {
    if (!existsSync(distRoot)) {
      throw new Error(`Missing dist package output: ${distRoot}`);
    }
    if (!existsSync(resolve(distRoot, 'package.json'))) {
      throw new Error(
        `Missing dist package manifest: ${resolve(distRoot, 'package.json')}`
      );
    }
  }
}

function assertPackContents() {
  const tarballs = {};
  for (const distRoot of distRoots) {
    const raw = run('npm pack --dry-run --json', distRoot).trim();
    const parsed = JSON.parse(raw);
    const packData = Array.isArray(parsed) ? parsed[0] : undefined;
    const files = packData?.files ?? [];
    for (const entry of files) {
      const filePath = String(entry.path ?? '');
      if (forbiddenFilePatterns.some((pattern) => pattern.test(filePath))) {
        throw new Error(
          `Forbidden file in npm pack output for ${distRoot}: ${filePath}`
        );
      }
    }
    const tarballName = String(packData?.filename ?? '');
    if (!tarballName) {
      throw new Error(`Could not determine tarball filename for ${distRoot}`);
    }
    run('npm pack --json', distRoot);
    tarballs[distRoot] = resolve(distRoot, tarballName);
  }
  return tarballs;
}

function assertNodeImportSmoke(tarballs) {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'continuum-release-smoke-'));
  try {
    run('npm init -y', tempRoot);
    const installArgs = [
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'contract')]}"`,
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'runtime')]}"`,
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'session')]}"`,
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'core')]}"`,
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'react')]}"`,
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'prompts')]}"`,
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'ai-connect')]}"`,
      `"${tarballs[resolve(process.cwd(), 'dist', 'packages', 'starter-kit')]}"`,
      'react@18',
    ].join(' ');
    run(`npm install ${installArgs}`, tempRoot);
    run(
      'node --input-type=module -e "await import(\'@continuum-dev/contract\'); await import(\'@continuum-dev/core\'); await import(\'@continuum-dev/react\'); await import(\'@continuum-dev/prompts\'); await import(\'@continuum-dev/ai-connect\'); await import(\'@continuum-dev/starter-kit\');"',
      tempRoot
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function main() {
  assertDistOutputsExist();
  const tarballs = assertPackContents();
  assertNodeImportSmoke(tarballs);
  process.stdout.write('Release package verification passed.\n');
}

main();
