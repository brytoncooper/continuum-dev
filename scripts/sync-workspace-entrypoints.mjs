import {
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAlignedReleasePackages } from './release-public-packages.mjs';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function resolveCompiledEntryPath(exportValue) {
  if (typeof exportValue === 'string') {
    if (!exportValue.startsWith('./')) {
      return null;
    }
    const trimmed = exportValue.slice(2);
    if (!trimmed.endsWith('.js') && !trimmed.endsWith('.mjs')) {
      return null;
    }
    return trimmed;
  }

  if (!exportValue || typeof exportValue !== 'object' || Array.isArray(exportValue)) {
    return null;
  }

  const candidate = exportValue.import ?? exportValue.default;
  if (typeof candidate !== 'string' || !candidate.startsWith('./')) {
    return null;
  }
  const trimmed = candidate.slice(2);
  if (!trimmed.endsWith('.js') && !trimmed.endsWith('.mjs')) {
    return null;
  }
  return trimmed;
}

function relativeSpecifier(fromFileAbs, toFileAbs) {
  let rel = relative(dirname(fromFileAbs), toFileAbs);
  if (!rel.startsWith('.')) {
    rel = `./${rel}`;
  }
  return rel.split('\\').join('/');
}

function ensureAiEngineContinuumExecutionDist(distRoot) {
  const bridgePath = join(distRoot, 'continuum-execution.mjs');
  const targetPath = join(distRoot, 'lib', 'continuum-execution', 'index.mjs');
  if (existsSync(bridgePath)) {
    return;
  }
  if (!existsSync(targetPath)) {
    throw new Error(
      `Cannot synthesize continuum-execution.mjs: missing ${targetPath}`
    );
  }
  const rel = relativeSpecifier(bridgePath, targetPath);
  writeFileSync(
    bridgePath,
    `export * from '${rel}';\n`,
    'utf8'
  );
}

function collectExportEntryPaths(exportsField) {
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return [];
  }

  const paths = [];
  for (const exportValue of Object.values(exportsField)) {
    const entry = resolveCompiledEntryPath(exportValue);
    if (entry) {
      paths.push(entry);
    }
  }
  return paths;
}

function main() {
  for (const pkg of loadAlignedReleasePackages()) {
    const packageRoot = pkg.packageRoot;
    const distRoot = pkg.distRoot;
    const manifestPath = join(packageRoot, 'package.json');
    const packageJson = loadJson(manifestPath);
    const exportsField = packageJson.exports;

    if (pkg.dir === 'ai-engine') {
      ensureAiEngineContinuumExecutionDist(distRoot);
    }

    const entryPaths = collectExportEntryPaths(exportsField);
    const entrySet = new Set(entryPaths);

    for (const entryPath of entryPaths) {
      const workspaceFile = join(packageRoot, entryPath);
      const distFile = join(distRoot, entryPath);
      if (!existsSync(distFile)) {
        throw new Error(
          `Missing compiled file for workspace shim ${workspaceFile}: expected ${distFile}`
        );
      }
      const rel = relativeSpecifier(workspaceFile, distFile);
      writeFileSync(workspaceFile, `export * from '${rel}';\n`, 'utf8');
    }

    const rootEntries = readdirSync(packageRoot, { withFileTypes: true });
    for (const dirent of rootEntries) {
      if (!dirent.isFile()) {
        continue;
      }
      const name = dirent.name;
      if (!name.endsWith('.js') && !name.endsWith('.mjs')) {
        continue;
      }
      if (!entrySet.has(name)) {
        unlinkSync(join(packageRoot, name));
      }
    }
  }

  process.stdout.write('Workspace entrypoints synced from dist.\n');
}

main();
