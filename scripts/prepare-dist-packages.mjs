import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageNames = ['contract', 'runtime', 'session', 'adapters', 'react', 'angular'];

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  for (const packageName of packageNames) {
    const sourceRoot = resolve(process.cwd(), 'packages', packageName);
    const distRoot = resolve(process.cwd(), 'dist', 'packages', packageName);
    const sourcePackageJsonPath = resolve(sourceRoot, 'package.json');
    const distPackageJsonPath = resolve(distRoot, 'package.json');
    const sourceReadmePath = resolve(sourceRoot, 'README.md');
    const distReadmePath = resolve(distRoot, 'README.md');

    if (!existsSync(distRoot)) {
      throw new Error(`Missing dist output for package "${packageName}": ${distRoot}`);
    }

    mkdirSync(distRoot, { recursive: true });

    const packageJson = loadJson(sourcePackageJsonPath);
    delete packageJson.nx;
    delete packageJson.devDependencies;
    delete packageJson.scripts;

    writeJson(distPackageJsonPath, packageJson);

    if (existsSync(sourceReadmePath)) {
      copyFileSync(sourceReadmePath, distReadmePath);
    }
  }
}

main();
