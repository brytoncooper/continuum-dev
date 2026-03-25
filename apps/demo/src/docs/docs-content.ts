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

export const docsProofChips = ['Gen UI runtime', 'Starter React', 'Vercel adapter'];

export const primaryInstall: DocsPrimaryInstall = {
  label: 'Fastest install',
  title: 'Starter Kit',
  body: 'Use Starter Kit for the fastest React on-ramp. If you already have a gen UI app, jump to the AI and headless integration guides first.',
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
    label: 'Explicit AI stack',
    command:
      'npm install @continuum-dev/react @continuum-dev/session @continuum-dev/ai-engine react',
  },
  {
    label: 'Runtime + Session',
    command: 'npm install @continuum-dev/runtime @continuum-dev/session',
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
