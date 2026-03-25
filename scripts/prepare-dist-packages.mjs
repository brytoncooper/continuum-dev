import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import { loadAlignedReleasePackages } from './release-public-packages.mjs';

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
  for (const releasePackage of loadAlignedReleasePackages()) {
    const sourceRoot = releasePackage.packageRoot;
    const distRoot = releasePackage.distRoot;
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
        `Missing dist output for package "${releasePackage.dir}": ${distRoot}`
      );
    }

    mkdirSync(distRoot, { recursive: true });

    const packageJson = loadJson(sourcePackageJsonPath);
    delete packageJson.nx;
    delete packageJson.devDependencies;
    delete packageJson.scripts;
    stripSourceExportCondition(packageJson);

    if (existsSync(sourceReadmePath)) {
      copyFileSync(sourceReadmePath, distReadmePath);
    }
    const readmeForDocumentation = existsSync(sourceReadmePath)
      ? readFileSync(sourceReadmePath, 'utf8')
      : '';
    const packageDocumentationJs = resolve(distRoot, 'package-documentation.js');
    const packageDocumentationDts = resolve(distRoot, 'package-documentation.d.ts');
    writeFileSync(
      packageDocumentationJs,
      `export default ${JSON.stringify(readmeForDocumentation)};\n`,
      'utf8'
    );
    writeFileSync(
      packageDocumentationDts,
      'declare const readme: string;\nexport default readme;\n',
      'utf8'
    );
    if (!packageJson.exports || typeof packageJson.exports !== 'object') {
      throw new Error(
        `Missing exports in source package.json for "${releasePackage.dir}"`
      );
    }
    packageJson.exports['./package-documentation'] = {
      types: './package-documentation.d.ts',
      import: './package-documentation.js',
      default: './package-documentation.js',
    };

    if (Array.isArray(packageJson.files)) {
      if (!packageJson.files.includes('package-documentation.js')) {
        packageJson.files.push('package-documentation.js', 'package-documentation.d.ts');
      }
    }

    writeJson(distPackageJsonPath, packageJson);

    if (existsSync(sourceContractReferencePath)) {
      copyFileSync(sourceContractReferencePath, distContractReferencePath);
    }
    if (existsSync(sourceLicensePath)) {
      copyFileSync(sourceLicensePath, distLicensePath);
    }
  }
}

main();
