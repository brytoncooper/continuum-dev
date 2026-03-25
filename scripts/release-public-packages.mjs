import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function parseJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadBuildDirs() {
  return parseJson(resolve(__dirname, 'release-build-package-dirs.json'));
}

function loadNpmPublishDirs() {
  return parseJson(resolve(__dirname, 'release-npm-publish-dirs.json'));
}

function mapDirToReleasePackage(dir) {
  const packageRoot = resolve(repoRoot, 'packages', dir);
  const packageJson = parseJson(resolve(packageRoot, 'package.json'));
  const projectJson = parseJson(resolve(packageRoot, 'project.json'));
  return {
    dir,
    packageName: packageJson.name,
    nxProjectName: projectJson.name,
    packageRoot,
    distRoot: resolve(repoRoot, 'dist', 'packages', dir),
    tsconfigPath: resolve(packageRoot, 'tsconfig.lib.json'),
  };
}

export function loadReleasePackages() {
  const dirs = loadBuildDirs();
  return dirs.map((dir) => mapDirToReleasePackage(dir));
}

function assertNpmPublishDirsAlignWithNx(buildPackages) {
  const npmDirs = loadNpmPublishDirs();
  const buildDirSet = new Set(buildPackages.map((p) => p.dir));
  for (const dir of npmDirs) {
    if (!buildDirSet.has(dir)) {
      throw new Error(
        `release-npm-publish-dirs.json references "${dir}" which is not in release-build-package-dirs.json.`
      );
    }
  }

  const nxJson = parseJson(resolve(repoRoot, 'nx.json'));
  const nxProjects = nxJson.release?.groups?.publicPackages?.projects;

  if (!Array.isArray(nxProjects)) {
    throw new Error(
      'nx.json is missing release.groups.publicPackages.projects.'
    );
  }

  const expectedFromNpmDirs = npmDirs.map((dir) => {
    const pkg = buildPackages.find((p) => p.dir === dir);
    if (!pkg) {
      throw new Error(`Internal error: missing build package for dir ${dir}`);
    }
    return pkg.nxProjectName;
  });

  const actual = nxProjects.map((value) => String(value));
  const expectedSet = [...new Set(expectedFromNpmDirs)].sort();
  const actualSet = [...new Set(actual)].sort();

  if (
    expectedFromNpmDirs.length !== expectedSet.length ||
    actual.length !== actualSet.length ||
    expectedSet.length !== actualSet.length ||
    expectedSet.some((project, index) => project !== actualSet[index])
  ) {
    throw new Error(
      [
        'npm publish directory list does not match nx.json publicPackages.',
        `Expected nx project names from release-npm-publish-dirs.json: ${expectedSet.join(', ')}`,
        `Found in nx.json: ${actualSet.join(', ')}`,
      ].join('\n')
    );
  }

  if (expectedFromNpmDirs.length !== actual.length) {
    throw new Error(
      'release-npm-publish-dirs.json and nx.json publicPackages differ in length.'
    );
  }

  for (let i = 0; i < expectedFromNpmDirs.length; i += 1) {
    if (expectedFromNpmDirs[i] !== actual[i]) {
      throw new Error(
        [
          'release-npm-publish-dirs.json order does not match nx.json publicPackages.projects.',
          `First mismatch at index ${i}: expected ${expectedFromNpmDirs[i]}, found ${actual[i]}.`,
        ].join('\n')
      );
    }
  }
}

export function loadAlignedReleasePackages() {
  const releasePackages = loadReleasePackages();
  assertNpmPublishDirsAlignWithNx(releasePackages);
  return releasePackages;
}

export function getRepoRoot() {
  return repoRoot;
}
