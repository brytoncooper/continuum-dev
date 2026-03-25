import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { loadAlignedReleasePackages } from './release-public-packages.mjs';

const releasePackages = loadAlignedReleasePackages();
const distRoots = releasePackages.map((pkg) => pkg.distRoot);

const skipRootNodeImportSpecifiers = new Set(['@continuum-dev/angular']);

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

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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

function hasCompiledImportTarget(exportValue) {
  if (typeof exportValue === 'string') {
    return (
      exportValue.startsWith('./') &&
      (exportValue.endsWith('.js') || exportValue.endsWith('.mjs'))
    );
  }
  if (!exportValue || typeof exportValue !== 'object' || Array.isArray(exportValue)) {
    return false;
  }
  const candidate = exportValue.import ?? exportValue.default;
  return (
    typeof candidate === 'string' &&
    candidate.startsWith('./') &&
    (candidate.endsWith('.js') || candidate.endsWith('.mjs'))
  );
}

function exportKeyToSpecifierSuffix(exportKey) {
  if (exportKey === '.') {
    return '';
  }
  if (exportKey.startsWith('./')) {
    return exportKey.slice(2);
  }
  return exportKey;
}

function collectPackageImportSpecifiers(packageName, exportsField) {
  const specifiers = [];
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    specifiers.push(packageName);
    return specifiers;
  }

  for (const [exportKey, exportValue] of Object.entries(exportsField)) {
    if (!hasCompiledImportTarget(exportValue)) {
      continue;
    }
    const suffix = exportKeyToSpecifierSuffix(exportKey);
    if (suffix === '') {
      specifiers.push(packageName);
    } else {
      specifiers.push(`${packageName}/${suffix}`);
    }
  }

  if (specifiers.length === 0) {
    specifiers.push(packageName);
  }
  return specifiers;
}

function collectAllImportSpecifiers() {
  const unique = new Set();
  for (const pkg of releasePackages) {
    const prepared = loadJson(resolve(pkg.distRoot, 'package.json'));
    const specs = collectPackageImportSpecifiers(
      pkg.packageName,
      prepared.exports
    );
    for (const spec of specs) {
      if (skipRootNodeImportSpecifiers.has(spec)) {
        continue;
      }
      unique.add(spec);
    }
  }
  return [...unique].sort();
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
      'react@18.3.1',
      'react-dom@18.3.1',
    ].join(' ');
    run(
      `npm install --registry https://registry.npmjs.org/ --legacy-peer-deps ${installArgs}`,
      tempRoot
    );
    const specifiers = collectAllImportSpecifiers();
    const importStatements = specifiers
      .map((spec) => `await import(${JSON.stringify(spec)});`)
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
