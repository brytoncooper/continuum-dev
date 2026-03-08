import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

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

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stripSourceExportCondition(packageJson) {
  const exportsField = packageJson.exports;
  if (!exportsField || typeof exportsField !== 'object') {
    return;
  }
  for (const exportValue of Object.values(exportsField)) {
    if (
      exportValue &&
      typeof exportValue === 'object' &&
      !Array.isArray(exportValue)
    ) {
      delete exportValue['@continuum-dev/source'];
    }
  }
}

function main() {
  for (const packageName of packageNames) {
    const sourceRoot = resolve(process.cwd(), 'packages', packageName);
    const distRoot = resolve(process.cwd(), 'dist', 'packages', packageName);
    const sourcePackageJsonPath = resolve(sourceRoot, 'package.json');
    const distPackageJsonPath = resolve(distRoot, 'package.json');
    const sourceReadmePath = resolve(sourceRoot, 'README.md');
    const distReadmePath = resolve(distRoot, 'README.md');
    const sourceContractReferencePath = resolve(
      sourceRoot,
      'CONTRACT_REFERENCE.md'
    );
    const distContractReferencePath = resolve(
      distRoot,
      'CONTRACT_REFERENCE.md'
    );
    const sourceLicensePath = resolve(sourceRoot, 'LICENSE');
    const distLicensePath = resolve(distRoot, 'LICENSE');

    if (!existsSync(distRoot)) {
      throw new Error(
        `Missing dist output for package "${packageName}": ${distRoot}`
      );
    }

    mkdirSync(distRoot, { recursive: true });

    const packageJson = loadJson(sourcePackageJsonPath);
    delete packageJson.nx;
    delete packageJson.devDependencies;
    delete packageJson.scripts;
    stripSourceExportCondition(packageJson);

    writeJson(distPackageJsonPath, packageJson);

    if (existsSync(sourceReadmePath)) {
      copyFileSync(sourceReadmePath, distReadmePath);
    }
    if (existsSync(sourceContractReferencePath)) {
      copyFileSync(sourceContractReferencePath, distContractReferencePath);
    }
    if (existsSync(sourceLicensePath)) {
      copyFileSync(sourceLicensePath, distLicensePath);
    }
  }
}

main();
