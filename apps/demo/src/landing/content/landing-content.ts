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
  eyebrow: 'The continuity layer for dynamic UI',
  title: 'Lose their work, lose their trust.',
  description:
    'When you clear user state because the UI changed, it does not feel like a technical limitation. It feels like the app broke. Continuum preserves user work so your app stays trustworthy.',
  callouts: [
    {
      title: 'Rename a field',
      body: 'The value follows meaning.',
    },
    {
      title: 'Reshape the flow',
      body: 'The work stays with the user.',
    },
    {
      title: 'Remove a field',
      body: 'Risky input stays recoverable.',
    },
  ] satisfies LandingCallout[],
} satisfies {
  eyebrow: string;
  title: string;
  description: string;
  callouts: LandingCallout[];
};

export const problemContent = {
  title: 'Why that feeling matters',
  description:
    'When a field disappears or a flow changes, users do not think about reconciliation. They think the product lost what they already did.',
  callouts: [
    {
      title: 'Losing user work feels like failure',
      body: "A reset does not feel technical. It feels like your product just threw away the user's work.",
    },
    {
      title: 'Wrong carry-forward feels unsafe',
      body: 'A value in the wrong place looks valid until it creates a harder problem later.',
    },
    {
      title: 'Dynamic UI makes this constant',
      body: 'AI generation, server-driven screens, and adaptive workflows turn structural change into a normal product behavior.',
    },
  ] satisfies LandingCallout[],
};

export const continuityContent = {
  title: 'Why this needs its own layer',
  description:
    'Continuum separates changing view structure from durable user data so user work does not rise and fall with the current tree.',
  columns: [
    {
      title: 'ViewDefinition',
      body: 'The current structure of the interface: layout, flow, semantics, and what the user sees right now.',
    },
    {
      title: 'DataSnapshot',
      body: 'The durable record of what the user has done so far: values, proposals, dirty state, lineage, and detached data.',
    },
  ] satisfies LandingCallout[],
  summary:
    'That separation is the unlock. UI changes stop reading like failure when continuity is handled intentionally instead of by accident.',
};

export const howItWorksContent = {
  title: 'How Continuum protects the work',
  description:
    'It turns continuity into infrastructure so UI changes stop reading like product failure.',
  steps: [
    {
      label: '1',
      title: 'Recognize what still means the same thing',
      body: 'Match nodes across versions by identity, key, and semantics.',
    },
    {
      label: '2',
      title: 'Keep what still belongs',
      body: 'Keep input only when the destination still means the same thing.',
    },
    {
      label: '3',
      title: 'Hold onto what no longer fits',
      body: 'Detach removed or incompatible input so it is preserved, not forced into the wrong place.',
    },
    {
      label: '4',
      title: 'Bring it back when it fits again',
      body: 'If the structure returns later, the preserved input can come back with it.',
    },
  ] satisfies LandingStep[],
};

export const packageStackContent = {
  title: 'Adopt only the layer you need',
  description:
    'Start at the contract, drop in reconciliation, or take the full stack if you want dynamic UI continuity without building it all yourself.',
  items: [
    {
      name: 'contract',
      title: 'Defines durable meaning',
      body: 'Owns the boundary between changing UI structure and durable user data so every other layer has a stable foundation.',
    },
    {
      name: 'runtime',
      title: 'Prevents destructive resets',
      body: 'Applies reconciliation across structural change so evolving views preserve continuity instead of wiping user work.',
    },
    {
      name: 'session',
      title: 'Keeps work recoverable',
      body: 'Adds persistence, checkpoints, event history, proposals, and the practical stateful layer teams need in production.',
    },
    {
      name: 'core',
      title: 'Bundles the critical path',
      body: 'Collects the lower-level Continuum stack into one dependency edge for teams that want the essentials together.',
    },
    {
      name: 'react',
      title: 'Fits your design system',
      body: 'Binds the model into React so you can keep your UI layer while Continuum handles continuity.',
    },
    {
      name: 'prompts',
      title: 'Guides stable generation',
      body: 'Provides prompt templates and output contracts for creating and evolving Continuum views with more predictable structure.',
    },
    {
      name: 'ai-connect',
      title: 'Connects model providers',
      body: 'Supplies headless provider clients and model catalogs so teams can wire Continuum into their AI stack.',
    },
    {
      name: 'vercel-ai-sdk',
      title: 'Adds continuity to streaming apps',
      body: 'Lets teams keep Vercel AI SDK transport and streaming while the Continuum adapter owns reconciliation and durable user state.',
    },
    {
      name: 'starter-kit',
      title: 'Starts from a working system',
      body: 'Provides an opinionated component map, primitives, and proposal-friendly UI so teams can ship faster before customizing.',
    },
  ] satisfies PackageItem[],
};

export const useCasesContent = {
  title: 'Where this becomes urgent',
  description: 'Anywhere losing input would feel like product failure.',
  callouts: [
    {
      title: 'AI-generated forms',
      body: 'Regenerate prompts, sections, or validations without dumping in-progress answers.',
    },
    {
      title: 'Server-driven screens',
      body: 'Ship new structures from the backend while active user work keeps its place.',
    },
    {
      title: 'Workflow experiences',
      body: 'Insert, remove, or reorder steps as the process changes without breaking the flow.',
    },
    {
      title: 'Long-lived sessions',
      body: 'Persist history, restore detached values, and make resumable work feel reliable instead of risky.',
    },
  ] satisfies LandingCallout[],
};

export const featureListContent = {
  title: 'What you get',
  description:
    'The continuity layer teams usually realize they needed only after users start losing work.',
  items: [
    {
      title: 'Deterministic reconciliation',
      body: 'Match nodes by id, key, and semantics so state survives layout churn instead of resetting on every regenerate.',
    },
    {
      title: 'Detached-value recovery',
      body: 'Removed or incompatible nodes do not silently destroy user work. Their state is preserved and can return later.',
    },
    {
      title: 'Conflict-safe proposals',
      body: 'Dirty user input is protected from AI clobbering through staged suggestions and explicit accept-or-reject flows.',
    },
    {
      title: 'Persistence and hydration',
      body: 'User work can persist to storage, survive refresh, and rehydrate with state, history, and continuity intact.',
    },
    {
      title: 'Checkpoints and rewind',
      body: 'Each push can create a recoverable timeline so teams get undo, rewind, and safer iteration on generated flows.',
    },
    {
      title: 'Diagnostics and audit trail',
      body: 'Diffs, issues, resolutions, and event history make continuity failures debuggable instead of mysterious.',
    },
    {
      title: 'Headless React rendering',
      body: 'Bring your own design system while Continuum owns the state wiring, collection behavior, and dynamic rendering contract.',
    },
    {
      title: 'Per-node failure isolation',
      body: 'Unknown or broken generated nodes fail safer so one bad component does not take down the whole screen.',
    },
  ] satisfies FeatureItem[],
};

export const ctaContent = {
  title: 'Keep UI changes from feeling like failure',
  description:
    'Start with the docs, then run the demo to see the breakage and the fix.',
  actions: [
    {
      title: 'Install Continuum',
      body: 'Choose Starter Kit or headless React and add continuity where your UI changes.',
      label: 'Read the docs',
      href: '/docs',
      tone: 'strong',
    },
    {
      title: 'See the failure and the fix',
      body: 'No API key needed. Watch one version lose the work and the other preserve it.',
      label: 'Open demo',
      href: '/playground',
      tone: 'default',
    },
    {
      title: 'Inspect the runtime',
      body: 'Read the open-source implementation and decide where it fits in your stack.',
      label: 'View GitHub',
      href: 'github',
      external: true,
      tone: 'soft',
    },
  ] satisfies LandingAction[],
};

export const closingCtaContent = {
  title: 'Protect the work. Protect the trust.',
  description:
    'Continuum keeps dynamic UI changes from turning into resets, silent mistakes, and broken trust.',
  actions: [
    {
      title: 'Read the docs',
      body: 'See where the stack fits and how to adopt it.',
      label: 'Open docs',
      href: '/docs',
      tone: 'strong',
    },
    {
      title: 'Run the demo',
      body: 'See the breakage, then see the preserved outcome.',
      label: 'Open demo',
      href: '/playground',
      tone: 'default',
    },
    {
      title: 'Browse the code',
      body: 'Inspect the runtime and integration points yourself.',
      label: 'GitHub',
      href: 'github',
      external: true,
      tone: 'soft',
    },
  ] satisfies LandingAction[],
};
