# ♾️ @continuum-dev/runtime

**The State Reconciliation Engine for Generative UI.** Saving state is easy. Reconciling state across unpredictable AI mutations is hard.

[![npm version](https://badge.fury.io/js/@continuum-dev%2Fruntime.svg)](https://badge.fury.io/js/@continuum-dev%2Fruntime)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem: AI Forces Reconciliation

In a traditional application, state management is trivial: a field has a static ID, and you map a value to it.

But in **Generative UI**, the AI doesn't just change data-it changes *structure*.

Imagine an AI agent renders a UI for a user. The user starts filling out a text field (`id: "field_123"`). Halfway through, the AI decides to "improve" the layout. It streams an updated UI that moves the field into a new grid, changes the container type, and renames the ID to `id: "grid_item_456"`.

Standard frameworks drop the old node, mount the new node, and the user's input is destroyed. The data wasn't lost because of a bad state store; it was orphaned because **the map between the state and the UI was mutated**.

To fix this, you don't need a better state manager. You need a reconciliation engine.

## The Solution

**Continuum Runtime** is a pure, stateless reconciliation engine designed specifically to solve the continuity problem in AI-generated interfaces.

Given a `priorView`, a `newView`, and the `priorData`, the engine performs deterministic semantic diffing. It matches nodes by stable keys (even when IDs change), executes data migrations, handles deep nesting restructures, and outputs a perfectly reconciled state ready for rendering.

```bash
npm install @continuum-dev/runtime

```

## Core Capabilities

* 🧠 **Semantic Reconciliation:** AI changed the node IDs? Wrapped them in a new `Row` or `Grid`? Continuum reconciles data via stable semantic keys, ensuring state survives massive layout overhauls.
* 🛡️ **Detached State Retention:** If the AI temporarily removes a field, Continuum doesn't throw the data away. It caches it as an "orphaned" value and automatically restores it if the AI brings the field back in a future turn.
* 🔄 **Data Migrations:** Upgrading a simple text `field` to a complex `collection`? Provide migration strategies to transform data payloads seamlessly across view transitions.
* ⚛️ **Pure & Framework Agnostic:** 100% pure TypeScript. Zero I/O side-effects. Use it to power the reconciliation layer of your React, Angular, Vue, or Vanilla JS agents.

---

## Quick Start

Here is how Continuum reconciles state when an AI completely restructures a UI mid-session.

```typescript
import { reconcile } from '@continuum-dev/runtime';

// 1. The old view and the user's current data
const priorView = {
  viewId: 'v1',
  version: '1.0',
  nodes: [{ id: 'random_id_1', key: 'user_email', type: 'field' }]
};

const priorData = {
  values: {
    'random_id_1': { value: 'alice@example.com' } // The user typed this!
  },
  lineage: { timestamp: Date.now(), sessionId: 'session_123', viewId: 'v1', viewVersion: '1.0' }
};

// 2. The AI generates a totally new layout, burying the field in a group and changing the ID.
const newView = {
  viewId: 'v2',
  version: '2.0',
  nodes: [{
    id: 'layout_group',
    type: 'group',
    children: [{ id: 'new_id_99', key: 'user_email', type: 'field' }]
  }]
};

// 3. Reconcile the AI's structural mutation! 🪄
const { reconciledState, diffs, issues, resolutions } = reconcile(
  newView,
  priorView,
  priorData
);

// Continuum reconciled the state using the stable 'user_email' key.
// Your data survived the AI's restructure!
console.log(reconciledState.values['layout_group/new_id_99'].value);
// Output: 'alice@example.com'

```

## Deep Dive: The Reconciliation Pipeline

When you call `reconcile()`, the runtime executes a strict, deterministic pipeline to figure out exactly what the AI did:

1. **Context Indexing:** Recursively indexes both views into lookup maps by `id` and `key`, using scoped nested paths plus dot-suffix key matching to detect structural shifts.
2. **Node Resolution:** Evaluates every node in the new view:
* **Carry:** Type and Hash match; data moves forward effortlessly.
* **Migrate:** Hash changed; trigger explicit or registry-based migration strategies to reshape the data payload.
* **Detach:** Type mismatch (e.g., a text input became a button); old data is safely stored in `detachedValues` rather than discarded.
* **Restore:** A newly generated node matches the key/type of a previously detached value, reconciling the old data back to life.


3. **Collection Mapping:** Normalizes arrays, enforcing `minItems`/`maxItems` constraints and remapping nested template paths if the AI restructures list items.
4. **Validation:** Runs lightweight constraints checks (`min`, `max`, `pattern`, `required`) to immediately surface data issues caused by the AI's new schema.

## Advanced: Migration Strategies

Sometimes an AI doesn't just move a node; it fundamentally changes its data structure. Continuum allows you to define explicit migration strategies during reconciliation.

```typescript
const result = reconcile(newView, priorView, priorData, {
  migrationStrategies: {
    // If the AI changes the 'status' node schema, run this transformation
    'status': (nodeId, priorNode, newNode, priorValue) => {
       const typedValue = priorValue as { value: string };
       return { value: typedValue.value.toUpperCase() };
    }
  },
  // Or pass a registry of chainable strategies defined by the view AST
  strategyRegistry: {
    'string-to-array': myStringToArrayFunction
  }
});

```

---

## The Continuum Ecosystem

This package is the core engine, but the Continuum SDK provides dedicated framework bindings so you don't have to wire this up manually:

* `@continuum-dev/session` - Stateful manager for conversational UI streams.
* `@continuum-dev/react` - React bindings and component renderer.
* `@continuum-dev/angular` - Angular bindings and directives.

## License

MIT © CooperContinuum
