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

export const heroContent = {
  eyebrow: 'Continuum demo',
  title: 'Your UI can change mid-session. Your user state should not.',
  description:
    'Continuum is the continuity layer for AI-generated, schema-driven, and server-driven interfaces. It separates AI-owned view structure from user-owned state so live screens can regenerate, reorder, and evolve without blowing away what the user already did.',
  callouts: [
    {
      title: 'Dynamic UI without state loss',
      body: 'Regenerate the interface, restructure the tree, and keep the in-progress session alive.',
    },
    {
      title: 'View and data are separate',
      body: 'The UI is allowed to change because the user data is not trapped inside the render tree.',
    },
    {
      title: 'Production-grade continuity',
      body: 'Carry, migrate, detach, restore, persist, rewind, and audit every structural change.',
    },
  ] satisfies LandingCallout[],
};

export const problemContent = {
  title: 'The real problem is not dynamic UI. The real problem is continuity collapse.',
  description:
    'When the UI tree changes, most apps treat the old nodes as gone and the new nodes as unrelated. That is why users lose typed input, partial work, and trust the moment an AI or backend updates the screen.',
  callouts: [
    {
      title: 'The structure mutates',
      body: 'An agent inserts steps, a workflow reorders sections, or the server swaps layouts while the user is still working.',
    },
    {
      title: 'The state was glued to the tree',
      body: 'Traditional UI state assumes a mostly stable component hierarchy, so structural change turns into dropped identity.',
    },
    {
      title: 'The session feels fragile',
      body: 'Input disappears, progress resets, proposals clobber edits, and every update feels like starting over.',
    },
  ] satisfies LandingCallout[],
};

export const continuityContent = {
  title: 'View is generated. Data is durable. That is the secret.',
  description:
    'Continuum splits the problem in two and turns that boundary into a first-class contract, so the interface can keep changing while the user keeps one continuity-aware state model underneath it.',
  columns: [
    {
      title: 'ViewDefinition',
      body: 'AI-owned structure: the versioned tree that describes layout, flow, semantics, and what the UI looks like right now.',
    },
    {
      title: 'DataSnapshot',
      body: 'User-owned state: the snapshot of values, suggestions, dirty flags, lineage, and detached data that survives pushes.',
    },
  ] satisfies LandingCallout[],
  summary:
    'That separation is the unlock: dynamic interfaces stop feeling disposable because state continuity is no longer an accident.',
};

export const howItWorksContent = {
  title: 'What Continuum does when the interface changes',
  description:
    'The workflow is simple at the surface and serious underneath. A new view arrives, the runtime reconciles it against prior state, and the session keeps moving instead of breaking.',
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
  title: 'A tight stack with sharp responsibilities',
  description:
    'Each layer handles one part of the problem so teams can adopt the model without inheriting a giant framework.',
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
      name: 'react',
      title: 'Renders headlessly',
      body: 'Binds the model into React so teams can bring their own design system without surrendering continuity.',
    },
  ] satisfies PackageItem[],
};

export const useCasesContent = {
  title: 'Built for interfaces that do not stay still',
  description:
    'Continuum matters anywhere structure can change after a session has already started.',
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
  title: 'Everything you need to make dynamic interfaces feel stable',
  description:
    'Continuum gives teams the continuity infrastructure that dynamic products usually have to invent for themselves once views start changing at runtime.',
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
  title: 'This is the pitch in one line',
  description:
    'Continuum gives teams a continuity layer for interfaces that regenerate at runtime, with reconciliation, persistence, proposals, diagnostics, collections, and headless rendering built in.',
  links: [
    { label: 'The problem', href: '#the-problem' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Feature highlights', href: '#feature-highlights' },
    { label: 'Package stack', href: '#package-stack' },
  ],
};
