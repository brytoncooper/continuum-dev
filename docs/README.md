# Continuum Documentation

## Guides

| Document | What it covers |
|---|---|
| [QUICK_START.md](QUICK_START.md) | 5-minute integration from zero to working app. Install, component map, provider, push schema, render, persist, rewind. |
| [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) | Advanced patterns: server-sent schemas, custom migration strategies, building protocol adapters, persistence strategies, session lifecycle. |
| [SCHEMA_CONTRACT.md](SCHEMA_CONTRACT.md) | Definitive reference for SchemaSnapshot, ComponentDefinition, reconciliation rules, state conventions, serialization format. |
| [AI_INTEGRATION.md](AI_INTEGRATION.md) | Connecting an AI agent to Continuum: prompt templates, OpenAI function calling, error handling, A2UI adapter usage. |

## Understand the Product

| Document | What it answers |
|---|---|
| [PRODUCT_VISION.md](PRODUCT_VISION.md) | What are we building and why? The north star, the problem statement, the strategic positioning, and the risks. |
| [IDEA_EVOLUTION.md](IDEA_EVOLUTION.md) | How has the thinking changed? Schema as durable artifact, rewind, delta ops, protocol-agnostic positioning, two-audience GTM, framework thesis. |

## Understand the Code

| Document | What it answers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How do the packages fit together? Data flow diagrams, session lifecycle, reconciliation flow. |
| [GAPS.md](GAPS.md) | What doesn't work yet? Every known limitation, categorized by severity. Living document -- check the "Last audited" date. |

## Package READMEs

| Package | README |
|---|---|
| `@continuum/contract` | [packages/contract/README.md](../packages/contract/README.md) |
| `@continuum/runtime` | [packages/runtime/README.md](../packages/runtime/README.md) |
| `@continuum/session` | [packages/session/README.md](../packages/session/README.md) |
| `@continuum/react` | [packages/react/README.md](../packages/react/README.md) |
| `@continuum/adapters` | [packages/adapters/README.md](../packages/adapters/README.md) |

## Roadmap

| Document | Phase | Status | Summary |
|---|---|---|---|
| [PHASE_2_ARCHITECTURE.md](PHASE_2_ARCHITECTURE.md) | 2 | Complete | Break up the large session.ts and reconcile.ts files into smaller modules. Internal refactor, no public API changes. |
| [PHASE_3_PROTOCOL.md](PHASE_3_PROTOCOL.md) | 3 | Complete | Build the adapter layer that lets Continuum work with external protocols like A2UI. Prove "protocol-agnostic" is real. |
| [PHASE_4_DOCS.md](PHASE_4_DOCS.md) | 4 | Complete | Full documentation suite: per-package READMEs, quick-start guide, integration guide, schema contract reference. |
