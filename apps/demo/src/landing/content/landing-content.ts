export type LandingCallout = {
  title: string;
  body: string;
};

export type LandingStep = {
  label: string;
  title: string;
  body: string;
};

export type PackageItem = {
  name: string;
  title: string;
  body: string;
};

export type FeatureItem = {
  title: string;
  body: string;
};

export type LandingAction = {
  title: string;
  body: string;
  label: string;
  href: string;
  external?: boolean;
  tone?: 'default' | 'soft' | 'strong';
};

export const heroContent = {
  eyebrow: 'State continuity for view-driven and AI-generated UIs',
  title: 'The view changed. The user lost their work.',
  description:
    'That is the failure mode. Typed input disappears, progress resets, and trust collapses the moment a model or backend ships a new view. Continuum preserves state through view changes with deterministic reconciliation.',
  callouts: [
    {
      title: 'Typed input gets wiped',
      body: 'A new view arrives and the user has to start over.',
    },
    {
      title: 'Progress resets mid-session',
      body: 'A reordered flow or regenerated form turns active work into discarded state.',
    },
    {
      title: 'Trust disappears fast',
      body: 'One bad update teaches users that dynamic UI is fragile.',
    },
  ] satisfies LandingCallout[],
};

export const problemContent = {
  title: 'Why AI-generated UIs lose user state',
  description:
    'The real problem is not that the interface changes. The real problem is that most apps tie user state to the current tree, so every structural update risks dropped input, broken progress, and lost trust.',
  callouts: [
    {
      title: 'The structure changes mid-session',
      body: 'An agent inserts steps, a backend swaps sections, or a workflow reorders the page while the user is still working.',
    },
    {
      title: 'Traditional state is glued to the tree',
      body: 'When node identity changes, many apps treat the old screen as gone and the new screen as unrelated, even when the user intent is still the same.',
    },
    {
      title: 'The product feels unreliable',
      body: 'Typed input disappears, progress resets, proposals clobber edits, and the user learns not to trust dynamic updates.',
    },
  ] satisfies LandingCallout[],
};

export const continuityContent = {
  title: 'How Continuum preserves state when the UI changes',
  description:
    'Continuum separates generated view structure from durable user state, turning that boundary into a first-class contract so the interface can keep evolving while the session stays coherent.',
  columns: [
    {
      title: 'ViewDefinition',
      body: 'The generated structure that describes layout, flow, semantics, and what the interface looks like right now.',
    },
    {
      title: 'DataSnapshot',
      body: 'The durable session state that carries values, proposals, dirty flags, lineage, and detached data through structural change.',
    },
  ] satisfies LandingCallout[],
  summary:
    'That separation is the unlock: dynamic UI stops feeling fragile because continuity is handled intentionally instead of by accident.',
};

export const howItWorksContent = {
  title: 'What the runtime does on every view update',
  description:
    'The workflow is easy to explain and serious underneath. A new view arrives, Continuum reconciles it against the prior session state, and the user keeps moving instead of starting over.',
  steps: [
    {
      label: '01',
      title: 'Push a new view',
      body: 'A fresh ViewDefinition arrives from an agent, server, workflow, or schema update.',
    },
    {
      label: '02',
      title: 'Reconcile against the prior snapshot',
      body: 'Runtime matches nodes by identity and semantics so it can reason about what stayed, moved, or disappeared.',
    },
    {
      label: '03',
      title: 'Preserve or migrate state',
      body: 'User data can be carried forward, migrated into new shapes, detached for later recovery, or restored when a structure returns.',
    },
    {
      label: '04',
      title: 'Keep the session usable',
      body: 'Session history, proposals, checkpoints, and headless React rendering keep the UI stable while the system evolves.',
    },
  ] satisfies LandingStep[],
};

export const packageStackContent = {
  title: 'Install the layer that matches your team',
  description:
    'Continuum is intentionally layered so teams can start with the install path that fits their workflow, from low-level contracts to headless React and the opinionated Starter Kit.',
  items: [
    {
      name: 'contract',
      title: 'Defines the language',
      body: 'Owns the view and data boundary, shared types, node model, and the contract that the rest of the stack depends on.',
    },
    {
      name: 'runtime',
      title: 'Reconciles change',
      body: 'Applies stateless reconciliation so evolving views can preserve continuity instead of resetting the session.',
    },
    {
      name: 'session',
      title: 'Owns the timeline',
      body: 'Adds persistence, checkpoints, event history, proposals, and a practical stateful shell around the runtime.',
    },
    {
      name: 'core',
      title: 'Bundles the runtime spine',
      body: 'Collects contract, runtime, and session into one convenience package so the lower-level Continuum stack ships as a single dependency edge.',
    },
    {
      name: 'react',
      title: 'Renders headlessly',
      body: 'Binds the model into React so teams can bring their own design system without surrendering continuity.',
    },
    {
      name: 'prompts',
      title: 'Model prompt contracts',
      body: 'Provides create/evolve/correction prompt templates and output contracts for Continuum ViewDefinition generation.',
    },
    {
      name: 'ai-connect',
      title: 'Provider connections',
      body: 'Headless provider clients and model catalogs for OpenAI and Google, with optional Anthropic support.',
    },
    {
      name: 'vercel-ai-sdk',
      title: 'Plugs into Vercel AI SDK',
      body: 'Lets teams keep Vercel AI SDK transport and message streaming while Continuum owns reconciliation and session continuity.',
    },
    {
      name: 'starter-kit',
      title: 'Gets teams moving fast',
      body: 'Provides an opinionated component map, primitives, and proposal-friendly UI for teams that want a polished starting point before customizing.',
    },
  ] satisfies PackageItem[],
};

export const useCasesContent = {
  title: 'Where developers use Continuum',
  description:
    'Continuum matters anywhere the interface can change after the session has already started.',
  callouts: [
    {
      title: 'AI-generated forms',
      body: 'Regenerate prompts, sections, or validations without resetting in-progress answers.',
    },
    {
      title: 'Server-driven screens',
      body: 'Let backends ship new structures while active sessions keep their continuity.',
    },
    {
      title: 'Workflow experiences',
      body: 'Insert, remove, or reorder steps as the process changes without losing progress.',
    },
    {
      title: 'Long-lived sessions',
      body: 'Persist history, restore detached values, and make resumable work feel dependable.',
    },
  ] satisfies LandingCallout[],
};

export const featureListContent = {
  title: 'What you get when you install Continuum',
  description:
    'Continuum gives developers the continuity infrastructure that dynamic UI products usually have to build for themselves once views start changing at runtime.',
  items: [
    {
      title: 'Deterministic reconciliation',
      body: 'Match nodes by id, key, and semantics so state survives layout churn instead of resetting on every regeneration.',
    },
    {
      title: 'Detached-value recovery',
      body: 'Removed or incompatible nodes do not silently destroy user work. Their state is preserved and can be restored later.',
    },
    {
      title: 'Conflict-safe proposals',
      body: 'Dirty user input is protected from AI clobbering by staged suggestions and explicit accept or reject flows.',
    },
    {
      title: 'Persistence and hydration',
      body: 'Sessions can persist to storage, survive refresh, and rehydrate with state, history, and continuity intact.',
    },
    {
      title: 'Checkpoints and rewind',
      body: 'Every push can create a recoverable timeline so teams get undo, rewind, and safer iteration on generated flows.',
    },
    {
      title: 'Diagnostics and audit trail',
      body: 'Diffs, issues, resolutions, and event history make the system debuggable instead of mysterious.',
    },
    {
      title: 'Headless React rendering',
      body: 'Bring your own design system while Continuum owns the session wiring, collection behavior, and dynamic rendering contract.',
    },
    {
      title: 'Per-node failure isolation',
      body: 'Unknown or broken generated nodes fail safer so one bad component does not blank the entire screen.',
    },
  ] satisfies FeatureItem[],
};

export const ctaContent = {
  title: 'Inspect the repo, install a layer, or prove it in the demo',
  description:
    'The fastest path is simple: inspect the open-source repo, read the install docs, and use the static demo to see why continuity matters before you wire a live provider.',
  actions: [
    {
      title: 'View Continuum on GitHub',
      body: 'See the source, tracked docs, package structure, and the open-source surface you would install.',
      label: 'Open GitHub',
      href: 'github',
      external: true,
      tone: 'strong',
    },
    {
      title: 'Install or read setup docs',
      body: 'Choose Starter Kit for the fastest path or headless React when you want full control over your components.',
      label: 'Open install docs',
      href: '/docs',
      tone: 'default',
    },
    {
      title: 'Try the no-key static demo',
      body: 'See state loss versus preserved continuity in a deterministic comparison without adding an API key.',
      label: 'Open static demo',
      href: '/playground',
      tone: 'soft',
    },
  ] satisfies LandingAction[],
};

export const closingCtaContent = {
  title: 'Ready to inspect the source and install?',
  description:
    'If the problem feels real, the next step is to inspect the GitHub repo and pick an install path. The demos exist to make that decision faster, not to slow it down.',
  actions: [
    {
      title: 'GitHub first',
      body: 'Open the repository when you want the quickest path to source, docs, packages, and install commands in one place.',
      label: 'View on GitHub',
      href: 'github',
      external: true,
      tone: 'strong',
    },
    {
      title: 'Install with docs open',
      body: 'Use the tracked docs to choose Starter Kit, headless React, or the lower-level runtime spine.',
      label: 'Read setup docs',
      href: '/docs',
      tone: 'default',
    },
    {
      title: 'Need one more proof point?',
      body: 'Run the static continuity demo if you want to feel the pain and the fix one more time before clicking through.',
      label: 'Try static demo',
      href: '/playground',
      tone: 'soft',
    },
  ] satisfies LandingAction[],
};
