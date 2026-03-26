# @continuum-dev/core

`@continuum-dev/core` is the convenience entrypoint for the lower-level Continuum model stack.

## Why This Exists

Some apps and framework bindings want one dependency edge for the lower-level Continuum spine instead of naming `contract`, `runtime`, and `session` separately. `core` exists for that case. It shortens imports when you already know you want the whole lower-level model stack together.

## How It Works

`@continuum-dev/core` does not add a new runtime layer. It re-exports the root public APIs of:

- `@continuum-dev/contract`
- `@continuum-dev/runtime`
- `@continuum-dev/session`

So when you import from `core`, you are still using those same packages and behaviors.

## What It Is

This package is a convenience facade over the lower-level Continuum model packages. It is not the owner of the architecture, and it does not redefine what contract, runtime, or session mean.

## Install

```bash
npm install @continuum-dev/core
```

## Easiest Path

Use `core` when you want contracts, reconciliation, and session lifecycle from one package.

```ts
import { createSession, type ViewDefinition } from '@continuum-dev/core';

const session = createSession();

const view: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      children: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
        },
      ],
    },
  ],
};

// `pushView` still goes through the Continuum runtime reconciliation path.
session.pushView(view);

// Value writes still go through the session interaction model.
session.updateState('profile/email', {
  value: 'ada@example.com',
  isDirty: true,
});
```

## Other Options

### Learn the lower-level boundaries directly

Use the leaf packages when you want the clearest package story:

- `@continuum-dev/contract` for view and data contracts
- `@continuum-dev/runtime` for stateless reconciliation
- `@continuum-dev/session` for the stateful session spine

### Import leaf subpaths directly when you need them

`core` only re-exports package roots. It does not replace leaf subpaths like:

- `@continuum-dev/runtime/view-stream`
- `@continuum-dev/runtime/node-lookup`
- `@continuum-dev/runtime/restore-candidates`

If you need those, import the leaf subpath itself.

## Dictionary Contract

`@continuum-dev/core` adds no new literals or runtime behavior of its own. Its contract is the union of the root exports of:

- `@continuum-dev/contract`
- `@continuum-dev/runtime`
- `@continuum-dev/session`

That means:

- contract types like `ViewDefinition` and `NodeValue` come through `core`
- root runtime helpers come through `core`
- root session APIs like `createSession(...)` come through `core`
- leaf subpaths do not

## Related Docs

- [Root README](../../README.md)
- [Contract README](../contract/README.md)
- [Runtime README](../runtime/README.md)
- [Session README](../session/README.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
