import overviewMarkdown from '../../../../README.md?raw';
import quickStartMarkdown from '../../../../docs/QUICK_START.md?raw';
import { repositoryFileUrl, repositoryUrl } from '../site-config';

export type DocsPrimaryInstall = {
  label: string;
  title: string;
  body: string;
  command: string;
  quickStartHref: string;
  demoHref: string;
};

export type DocsSecondaryInstall = {
  label: string;
  command: string;
};

export type DocsLinkItem = {
  label: string;
  href: string;
};

export type DocsDocument = {
  id: 'quick-start' | 'overview';
  label: string;
  repoPath: string;
  githubHref: string;
  body: string;
};

export const docsProofChips = ['Starter Kit', 'Headless React', 'Core package'];

export const primaryInstall: DocsPrimaryInstall = {
  label: 'Recommended install',
  title: 'Starter Kit',
  body: 'Use Starter Kit for the fastest way to get Continuum running in a React app.',
  command: 'npm install @continuum-dev/starter-kit react',
  quickStartHref: '#docs-viewer',
  demoHref: '/playground',
};

export const docsDocuments: DocsDocument[] = [
  {
    id: 'quick-start',
    label: 'Quick Start',
    repoPath: 'docs/QUICK_START.md',
    githubHref: repositoryFileUrl('docs/QUICK_START.md'),
    body: quickStartMarkdown,
  },
  {
    id: 'overview',
    label: 'README',
    repoPath: 'README.md',
    githubHref: repositoryFileUrl('README.md'),
    body: overviewMarkdown,
  },
];

export const secondaryInstalls: DocsSecondaryInstall[] = [
  {
    label: 'Headless React',
    command: 'npm install @continuum-dev/react @continuum-dev/core react',
  },
  {
    label: 'Core',
    command: 'npm install @continuum-dev/core',
  },
];

export const secondaryLinks: DocsLinkItem[] = [
  {
    label: 'Integration Guide',
    href: repositoryFileUrl('docs/INTEGRATION_GUIDE.md'),
  },
  {
    label: 'AI Integration',
    href: repositoryFileUrl('docs/AI_INTEGRATION.md'),
  },
  {
    label: 'View Contract',
    href: repositoryFileUrl('docs/VIEW_CONTRACT.md'),
  },
  {
    label: 'Repository',
    href: repositoryUrl,
  },
];
