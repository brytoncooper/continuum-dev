import { repositoryFileUrl } from '../site-config';

export type DocsInstallOption = {
  title: string;
  description: string;
  command: string;
};

export type DocsLinkItem = {
  title: string;
  description: string;
  href: string;
};

export const installOptions: DocsInstallOption[] = [
  {
    title: 'Starter Kit',
    description:
      'Fastest path for teams that want opinionated primitives, proposal-friendly UI, and prompt helpers out of the box.',
    command: 'npm install @continuum-dev/starter-kit react',
  },
  {
    title: 'Headless React',
    description:
      'Use Continuum as a headless continuity layer and bring your own components and styling from day one.',
    command: 'npm install @continuum-dev/react @continuum-dev/core react',
  },
  {
    title: 'Core only',
    description:
      'Build directly against the runtime spine when you want lower-level session and reconciliation control.',
    command: 'npm install @continuum-dev/core',
  },
];

export const guideLinks: DocsLinkItem[] = [
  {
    title: 'Quick Start',
    description: 'From install to working Continuum app with the recommended starter and headless paths.',
    href: repositoryFileUrl('docs/QUICK_START.md'),
  },
  {
    title: 'Integration Guide',
    description: 'Production patterns for persistence, migrations, server-driven views, and lifecycle control.',
    href: repositoryFileUrl('docs/INTEGRATION_GUIDE.md'),
  },
  {
    title: 'AI Integration',
    description: 'Prompt composition, correction loops, and agent-side view generation guidance.',
    href: repositoryFileUrl('docs/AI_INTEGRATION.md'),
  },
];

export const packageLinks: DocsLinkItem[] = [
  {
    title: '@continuum-dev/contract',
    description: 'Shared view and data contracts for the whole Continuum stack.',
    href: repositoryFileUrl('packages/contract/README.md'),
  },
  {
    title: '@continuum-dev/runtime',
    description: 'Stateless reconciliation engine for evolving views and preserved state.',
    href: repositoryFileUrl('packages/runtime/README.md'),
  },
  {
    title: '@continuum-dev/session',
    description: 'Stateful session lifecycle, proposals, checkpoints, and persistence.',
    href: repositoryFileUrl('packages/session/README.md'),
  },
  {
    title: '@continuum-dev/core',
    description: 'Thin facade over contract, runtime, and session for lower-level adopters.',
    href: repositoryFileUrl('packages/core/README.md'),
  },
  {
    title: '@continuum-dev/react',
    description: 'Headless React bindings built on top of core.',
    href: repositoryFileUrl('packages/react/README.md'),
  },
  {
    title: '@continuum-dev/starter-kit',
    description: 'Opinionated primitives, proposal UI, and a ready-to-use component map.',
    href: repositoryFileUrl('packages/starter-kit/README.md'),
  },
  {
    title: '@continuum-dev/prompts',
    description: 'Prompt templates and helpers for create, evolve, and correction loops.',
    href: repositoryFileUrl('packages/prompts/README.md'),
  },
];

export const deepReferenceLinks: DocsLinkItem[] = [
  {
    title: 'Contract Reference',
    description: 'View and data contract details for the lowest-level model.',
    href: repositoryFileUrl('packages/contract/CONTRACT_REFERENCE.md'),
  },
  {
    title: 'React Deep Dive',
    description: 'Rendering behavior, collections, failure isolation, and hook internals.',
    href: repositoryFileUrl('packages/react/LIBRARY_DEEP_DIVE.md'),
  },
  {
    title: 'Session Reference',
    description: 'Session lifecycle, proposals, checkpoints, and persistence behavior.',
    href: repositoryFileUrl('packages/session/SESSION_LIBRARY_REFERENCE.md'),
  },
  {
    title: 'Runtime Reference',
    description: 'Reconciliation engine details and matching behavior.',
    href: repositoryFileUrl('packages/runtime/RUNTIME_COMPREHENSIVE_REFERENCE.md'),
  },
];
