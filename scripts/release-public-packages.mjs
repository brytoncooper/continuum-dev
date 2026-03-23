import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadReleasePackages() {
  const dirs = loadJson(resolve(__dirname, 'release-public-package-dirs.json'));
  return dirs.map((dir) => {
    const packageRoot = resolve(repoRoot, 'packages', dir);
    const packageJson = loadJson(resolve(packageRoot, 'package.json'));
    const projectJson = loadJson(resolve(packageRoot, 'project.json'));
    return {
      dir,
      packageName: packageJson.name,
      nxProjectName: projectJson.name,
      packageRoot,
      distRoot: resolve(repoRoot, 'dist', 'packages', dir),
      tsconfigPath: resolve(packageRoot, 'tsconfig.lib.json'),
    };
  });
}

export function loadAlignedReleasePackages() {
  const releasePackages = loadReleasePackages();
  const nxJson = loadJson(resolve(repoRoot, 'nx.json'));
  const nxProjects = nxJson.release?.groups?.publicPackages?.projects;

  if (!Array.isArray(nxProjects)) {
    throw new Error(
      'nx.json is missing release.groups.publicPackages.projects.'
    );
  }

  const expectedProjects = releasePackages.map((pkg) => pkg.nxProjectName);
  const actualProjects = nxProjects.map((value) => String(value));
  const expectedSet = [...new Set(expectedProjects)].sort();
  const actualSet = [...new Set(actualProjects)].sort();

  if (
    expectedProjects.length !== expectedSet.length ||
    actualProjects.length !== actualSet.length ||
    expectedSet.length !== actualSet.length ||
    expectedSet.some((project, index) => project !== actualSet[index])
  ) {
    throw new Error(
      [
        'Release package directories do not match nx.json publicPackages.',
        `Expected from package directories: ${expectedSet.join(', ')}`,
        `Found in nx.json: ${actualSet.join(', ')}`,
      ].join('\n')
    );
  }

  return releasePackages;
}

export function getRepoRoot() {
  return repoRoot;
}
