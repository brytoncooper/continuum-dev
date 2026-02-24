---
title: Idea Evolution -- From Continuity Runtime to Protocol Layer
status: Living Document
date: 2026-02-19
tags: [strategy, evolution, architecture, product]
---

# Idea Evolution

This document tracks the strategic evolution of Continuum from its original framing as an AI continuity runtime to its current positioning as a protocol-agnostic state layer and eventual framework foundation.

---

## 1. Original Framing

Continuum started as a reconciliation engine -- the "brain" that deterministically rehydrates user state when an AI agent regenerates a UI. The initial architecture centered on:

- A contract layer defining schemas, state, and interactions
- A stateless reconciliation engine that diffs schemas and carries forward state
- A session manager orchestrating the lifecycle
- React bindings for rendering

The implicit assumption: the AI generates a schema, the user interacts with it, the AI regenerates, and reconciliation bridges the gap.

---

## 2. Key Insight: Schema as Durable Artifact

The original model assumed the AI would regenerate the schema each time the user returned. This is fragile. The AI might produce something different, the model might have been updated, or the context window might have shifted.

**The pivot:** Don't ask the AI to recreate -- store what it created. The schema is not ephemeral output. It's a record worth preserving. When the user returns, load the stored schema directly. No AI call needed. The AI only gets involved when the user requests a change.

This shifts the interaction model from "AI regenerates everything, hope it matches" to "user has their workspace, AI assists on request." The user is in control.

**Implications:**
- The session's `serialize()` already stores the current schema alongside state -- this becomes the canonical persistence mechanism
- `deserialize()` restores a complete working session without any external dependency
- The AI's job shrinks from "recreate the entire UI" to "modify this specific thing the user pointed at"
- Schema-aware prompting becomes possible: the compact schema JSON is a tiny, structured context payload the AI can read to understand exactly what's on screen

---

## 3. Rewind as First-Class Feature

The existing checkpoint/restore mechanism (`checkpoint()`, `restoreFromCheckpoint()`) provides the primitive. The evolution: make it automatic and user-facing.

Every `pushSchema` auto-creates a checkpoint. The user gets a timeline of every schema version with full state at that point. They can rewind to any prior version instantly -- pure local operation, no AI call.

**Why this matters:**
- The user can say "I liked that better before" and get it back immediately
- After rewinding, the current schema is sent to the AI as context so it knows the user's current view
- The audit trail captures the full history: schema created, user interacted, AI modified, user rewound, AI modified again

---

## 4. Delta Operations Protocol

Instead of the AI returning a full schema every time, it returns a patch:

```json
{
  "operations": [
    { "op": "remove", "target": "full_name" },
    { "op": "add", "component": { "id": "age", "type": "slider" }, "after": "email" },
    { "op": "update", "target": "subscribe", "fields": { "type": "toggle" } }
  ]
}
```

The system applies the patch to the current schema, producing a new version. Reconciliation runs as normal on the result.

**Benefits:**
- Dramatically fewer tokens (modify 1 of 20 components = 3 lines instead of 20)
- Less hallucination surface (the AI only describes what changed, not 19 components it has to faithfully reproduce)
- Reconciliation becomes trivial (the diff is the intent)
- Richer audit trail (captures the "why" not just the "what")

---

## 5. Protocol-Agnostic Positioning

Continuum is not an A2UI library, or a custom-schema library, or any specific protocol's implementation. It is the state continuity layer that sits underneath any agent-UI protocol.

```
Any Protocol (A2UI, custom, future) --> Adapter --> SchemaSnapshot --> Continuum Session --> Renderer
```

`SchemaSnapshot` is the internal canonical format. External protocols are adapters that transform into it. A2UI is one adapter. A custom agent protocol is another. Whatever comes next plugs in the same way.

**What Continuum owns:** State lifecycle, persistence, reconciliation, rewind, audit trail.

**What Continuum does not own:** The protocol format, the AI model, the rendering library, the transport layer.

---

## 6. Two-Audience Go-to-Market

### Primary (Urgent): Generative AI Developers

Developers building AI-agent-driven UIs are making foundational architecture decisions right now. Once a team builds their own schema format and state management, they're not ripping it out. The window is while these patterns are still forming.

**Pitch:** "Your AI generates UI. Your user's state breaks every time. Continuum is the protocol layer between your agent and your UI -- schema persistence, state reconciliation, rewind, and audit built in."

### Parallel: Traditional App Developers

Every developer has built a form where the user loses work on refresh. Every developer has built a multi-step flow where the back button destroys state.

**Pitch:** "Persistent, rewindable state for any React app. Drop-in replacement for useState. When you're ready for AI, you're already wired for it."

### The Migration-Ready Story

The traditional-app pitch doubles as a generative AI preparation story:

> "You're going to add AI to your product. When you do, your current architecture will fight you. Or you adopt Continuum now -- today it gives you persistent state and undo/rewind. When you're ready for AI, your app is already structured for it. No rewrite."

### Graduated Adoption

1. **Audience 1 (now):** Persistent, rewindable state (hooks only, no schema needed)
2. **Audience 2 (growing):** AI-generated UIs with schema reconciliation
3. **Audience 3 (enterprise):** Audit trail, schema-to-data relational mapping, compliance

Same library, progressive disclosure. Each layer pulls deeper.

---

## 7. Enterprise Audit Vision

When schemas are durable artifacts and every state change is logged, a compliance story emerges naturally:

- Schema v1 was shown at timestamp T1, user entered data D1
- Schema v2 was shown at T2, reconciliation carried X and dropped Y, user entered D2
- The full chain is reproducible: given a schema + interactions, you reconstruct the exact UI state

Enterprise companies could store schema IDs alongside business data in their databases. To see what the user saw: pull the schema, pull the data, render it. Full reproducibility.

This is not a feature to build now. It is the natural consequence of the architecture: serializable sessions, versioned schemas, event logs, checkpoints.

---

## 8. Long-Term Framework Thesis

**This is strategic documentation. It is not a near-term deliverable.**

### The Bet

Current frontend frameworks (React, Vue, Svelte, Angular) were designed for developer-authored component trees. Generative AI breaks that assumption. The industry will shift from template-based UI (developer writes the tree) to primitive-based UI (developer defines building blocks, schemas define the tree).

### Why the Runtime-First Strategy Works

Launching "Continuum Framework" today would mean competing head-on with React. Instead, the runtime/SDK complements React. Developers adopt it for persistence, rewind, and reconciliation. Their state flows through Continuum sessions. Their components render through component maps.

When the framework ships, the migration pitch is concrete: "You're already using Continuum for state. Your components already implement `ContinuumComponentProps`. Your schemas already define your UI. Drop the React wrapper -- Continuum renders natively now."

### What the Framework Would Look Like

- Schema-first, not component-first (define primitives, schemas define the tree)
- State as first-class citizen (persistent, rewindable, serializable, auditable by default)
- Protocol-native (adapter pattern becomes the framework's plugin system)
- Reconciliation as the rendering model (diff schemas and state, not virtual DOM)

### The Platform Play

The framework enables: hosted schema storage, session replay, audit dashboards, collaboration -- the deployment and observability layer for generative UI.

### Risk Acknowledgment

This bet depends on generative AI becoming the dominant UI production model, not just a feature. The SDK business stands on its own regardless. The framework is free upside, not a dependency. Nothing built now forecloses it.
