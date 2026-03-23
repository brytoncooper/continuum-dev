import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { loadAlignedReleasePackages } from './release-public-packages.mjs';

const releasePackages = loadAlignedReleasePackages();
const distRoots = releasePackages.map((pkg) => pkg.distRoot);

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
      ...releasePackages.map((pkg) => {
        const path = tarballs[pkg.distRoot];
        if (!path) {
          throw new Error(`Missing tarball for dist root: ${pkg.distRoot}`);
        }
        return `"${path}"`;
      }),
      'react@18',
      'react-dom@18',
    ].join(' ');
    run(`npm install ${installArgs}`, tempRoot);
    const importStatements = releasePackages
      .map((pkg) => `await import(${JSON.stringify(pkg.packageName)});`)
      .join(' ');
    run(
      `node --input-type=module -e "${importStatements.replaceAll(
        '"',
        '\\"'
      )}"`,
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
