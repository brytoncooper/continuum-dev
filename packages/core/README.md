# @continuum-dev/core

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

## Core Premise: The Ephemerality Gap

The Ephemerality Gap is the mismatch between ephemeral, regenerating interfaces and durable user intent.
Continuum keeps UI structure and user state separate, then uses deterministic reconciliation so user intent survives schema changes.

`@continuum-dev/core` is the convenience entrypoint for the Continuum runtime spine.

It re-exports the public surface from:

- `@continuum-dev/contract`
- `@continuum-dev/runtime`
- `@continuum-dev/session`

The runtime package keeps a small **root** API (`reconcile`, structural and value-write entrypoints, shared protocol constants, and core types). Helpers such as validation, node lookup, streamed view parts, and restore-candidate search are published on explicit `@continuum-dev/runtime/...` subpaths. Core does not narrow that layout: anything those packages export remains available through core, but understanding `@continuum-dev/runtime` on its own makes the contract clearer than treating core as the definition of “what runtime is.”

Use core when you want one dependency edge for the lower-level Continuum model, or when other framework bindings should depend on the runtime spine without naming each package separately.

## Install

```bash
npm install @continuum-dev/core
```

## What it includes

- View and data contracts
- Reconciliation engine exports
- Session lifecycle and persistence APIs

## Example

```ts
import { createSession, type ViewDefinition } from '@continuum-dev/core';

const session = createSession();

const view: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [{ id: 'email', type: 'field', dataType: 'string' }],
};

session.pushView(view);
```
