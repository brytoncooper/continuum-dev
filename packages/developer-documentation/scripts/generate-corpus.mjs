import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');
const repoRoot = resolve(packageRoot, '../..');

function readUtf8(path) {
  return readFileSync(path, 'utf8');
}

function slugId(repoPath) {
  const base = repoPath
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
  return base.replace(/^-+|-+$/g, '') || 'doc';
}

const PUBLIC_DOCS = [
  {
    file: 'AI_INTEGRATION.md',
    label: 'AI Integration Guide',
    groupId: 'ai-engine',
    groupLabel: '@continuum-dev/ai-engine',
  },
  {
    file: 'HOW_CONTINUITY_DECISIONS_WORK.md',
    label: 'How Continuity Decisions Work',
    groupId: 'runtime',
    groupLabel: '@continuum-dev/runtime',
  },
  {
    file: 'QUICK_START.md',
    label: 'Quick Start',
    groupId: 'starter-kit',
    groupLabel: '@continuum-dev/starter-kit',
  },
  {
    file: 'INTEGRATION_GUIDE.md',
    label: 'Integration Guide',
    groupId: 'react',
    groupLabel: '@continuum-dev/react',
  },
  {
    file: 'VIEW_CONTRACT.md',
    label: 'View Contract Reference',
    groupId: 'contract',
    groupLabel: '@continuum-dev/contract',
  },
];

const TOP_LEVEL_DOCUMENT_ORDER = new Map([
  ['docs/AI_INTEGRATION.md', 0],
  ['docs/HOW_CONTINUITY_DECISIONS_WORK.md', 1],
  ['docs/QUICK_START.md', 2],
  ['docs/INTEGRATION_GUIDE.md', 3],
  ['docs/VIEW_CONTRACT.md', 4],
  ['README.md', 5],
]);

const PACKAGE_DOCUMENTS = [
  {
    repoPath: 'packages/adapters/README.md',
    label: '@continuum-dev/adapters',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/ai-core/README.md',
    label: '@continuum-dev/ai-core',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/ai-connect/README.md',
    label: '@continuum-dev/ai-connect',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/ai-engine/README.md',
    label: '@continuum-dev/ai-engine',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/angular/README.md',
    label: '@continuum-dev/angular',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/contract/README.md',
    label: '@continuum-dev/contract',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/core/README.md',
    label: '@continuum-dev/core',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/prompts/README.md',
    label: '@continuum-dev/prompts',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/protocol/README.md',
    label: '@continuum-dev/protocol',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/react/README.md',
    label: '@continuum-dev/react',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/runtime/README.md',
    label: '@continuum-dev/runtime',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/session/README.md',
    label: '@continuum-dev/session',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/session/STREAMING.md',
    label: 'Session streaming',
    category: 'package-extra',
  },
  {
    repoPath: 'packages/starter-kit/README.md',
    label: '@continuum-dev/starter-kit',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/starter-kit-ai/README.md',
    label: '@continuum-dev/starter-kit-ai',
    category: 'package-readme',
  },
  {
    repoPath: 'packages/vercel-ai-sdk-adapter/README.md',
    label: '@continuum-dev/vercel-ai-sdk-adapter',
    category: 'package-readme',
  },
];

function packageNameFromRepoPath(repoPath) {
  const match = /^packages\/([^/]+)/.exec(repoPath);
  return match ? match[1] : '';
}

function pushDocument(documents, { repoPath, label, category, groupId, groupLabel, body }) {
  documents.push({
    id: `doc-${slugId(repoPath)}`,
    label,
    repoPath,
    category,
    groupId,
    groupLabel,
    body,
  });
}

function main() {
  const documents = [];

  const rootReadme = resolve(repoRoot, 'README.md');
  if (existsSync(rootReadme)) {
    pushDocument(documents, {
      repoPath: 'README.md',
      label: 'README',
      category: 'root',
      groupId: 'repository',
      groupLabel: 'Continuum',
      body: readUtf8(rootReadme),
    });
  }

  const docsDir = join(repoRoot, 'docs');
  const allowedDocs = new Set(PUBLIC_DOCS.map((e) => e.file));
  if (existsSync(docsDir)) {
    for (const name of readdirSync(docsDir)) {
      if (!name.endsWith('.md') || !allowedDocs.has(name)) {
        continue;
      }
      const meta = PUBLIC_DOCS.find((e) => e.file === name);
      const filePath = join(docsDir, name);
      pushDocument(documents, {
        repoPath: `docs/${name}`,
        label: meta.label,
        category: 'repo-docs',
        groupId: meta.groupId,
        groupLabel: meta.groupLabel,
        body: readUtf8(filePath),
      });
    }
  }

  for (const entry of PACKAGE_DOCUMENTS) {
    const filePath = resolve(repoRoot, entry.repoPath);
    if (!existsSync(filePath)) {
      continue;
    }
    const pkg = packageNameFromRepoPath(entry.repoPath);
    pushDocument(documents, {
      repoPath: entry.repoPath,
      label: entry.label,
      category: entry.category,
      groupId: pkg,
      groupLabel: `@continuum-dev/${pkg}`,
      body: readUtf8(filePath),
    });
  }

  documents.sort((a, b) => {
    const aTopLevelOrder =
      TOP_LEVEL_DOCUMENT_ORDER.get(a.repoPath) ?? Number.MAX_SAFE_INTEGER;
    const bTopLevelOrder =
      TOP_LEVEL_DOCUMENT_ORDER.get(b.repoPath) ?? Number.MAX_SAFE_INTEGER;
    if (aTopLevelOrder !== bTopLevelOrder) {
      return aTopLevelOrder - bTopLevelOrder;
    }
    const g = a.groupLabel.localeCompare(b.groupLabel);
    if (g !== 0) return g;
    return a.repoPath.localeCompare(b.repoPath);
  });

  const outDir = resolve(packageRoot, 'src', 'generated');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'corpus-data.ts');
  const serialized = JSON.stringify(documents, null, 2);
  writeFileSync(
    outPath,
    `export type DeveloperDocsDocumentCategory =
  | 'root'
  | 'repo-docs'
  | 'package-readme'
  | 'package-extra';

export type DeveloperDocsDocument = {
  readonly id: string;
  readonly label: string;
  readonly repoPath: string;
  readonly category: DeveloperDocsDocumentCategory;
  readonly groupId: string;
  readonly groupLabel: string;
  readonly body: string;
};

export const developerDocsDocuments: readonly DeveloperDocsDocument[] = ${serialized};
`,
    'utf8'
  );
  process.stdout.write(`Wrote ${outPath} (${documents.length} documents)\n`);
}

main();
