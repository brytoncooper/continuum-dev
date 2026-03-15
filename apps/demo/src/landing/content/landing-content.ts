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
  eyebrow: 'For AI-generated and server-driven UI',
  title: 'Regenerate UI without making users start over.',
  description:
    'When your UI changes shape, users should keep what they already entered. Continuum carries user work forward safely as fields move, rename, and regroup.',
  callouts: [
    {
      title: 'Rename a field',
      body: 'The value stays with the field meaning.',
    },
    {
      title: 'Reorder steps',
      body: 'In-progress work survives step changes.',
    },
    {
      title: 'Change schema',
      body: 'Safe values carry forward, unsafe values detach.',
    },
  ] satisfies LandingCallout[],
} satisfies { eyebrow: string; title: string; description: string; callouts: LandingCallout[] };

export const problemContent = {
  title: 'Why standard state tools fail here',
  description:
    'The UI changed, but the user was still doing the same task. Most state tools only track the current tree, so they cannot decide what should safely carry into the new structure.',
  callouts: [
    {
      title: 'Structure evolves',
      body: 'Fields rename, sections reorder, schema shifts. Your UI adapts in real time.',
    },
    {
      title: 'State tools stay local',
      body: 'Redux, forms, persistence only guard the current shape. No mapping across change.',
    },
    {
      title: 'Unsafe carry-forward breaks trust',
      body: 'Blind recovery can put values in the wrong place. Discarding them feels like a bug.',
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
  title: 'How Continuum handles changing UI',
  description:
    'Each update is checked so user work can carry forward when safe and stay detached when it is not.',
  steps: [
    {
      label: '1',
      title: 'Structure arrives',
      body: 'New view from model, server, or workflow.',
    },
    {
      label: '2',
      title: 'Intent maps',
      body: 'Runtime matches old structure to new. Identity, semantics, safety all matter.',
    },
    {
      label: '3',
      title: 'Decide per value',
      body: 'Carry forward, migrate, detach, or reject based on safety rules.',
    },
    {
      label: '4',
      title: 'User keeps going',
      body: 'Session intact. Progress saved. Trust earned.',
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
  title: 'Start shipping durable UI',
  description:
    'Install in minutes. Then run the demo to see how it all works.',
  actions: [
    {
      title: 'Install Continuum',
      body: 'Choose Starter Kit or headless React. Setup docs walk you through.',
      label: 'Read install docs',
      href: '/docs',
      tone: 'strong',
    },
    {
      title: 'See it in action',
      body: 'No API key needed. Watch intent survive a regeneration.',
      label: 'Try demo',
      href: '/playground',
      tone: 'default',
    },
    {
      title: 'Review source',
      body: 'Open-source runtime on GitHub.',
      label: 'View on GitHub',
      href: 'github',
      external: true,
      tone: 'soft',
    },
  ] satisfies LandingAction[],
};

export const closingCtaContent = {
  title: 'Make your UI reliable.',
  description:
    'Install and start protecting user progress today.',
  actions: [
    {
      title: 'Install now',
      body: 'Setup takes minutes.',
      label: 'Read docs',
      href: '/docs',
      tone: 'strong',
    },
    {
      title: 'See the demo',
      body: 'No signup required.',
      label: 'Try it',
      href: '/playground',
      tone: 'default',
    },
    {
      title: 'Explore the code',
      body: 'Open-source and built for scale.',
      label: 'GitHub',
      href: 'github',
      external: true,
      tone: 'soft',
    },
  ] satisfies LandingAction[],
};
