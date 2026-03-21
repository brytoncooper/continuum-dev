---
name: continuum-framework-boundary-audit
description: Framework boundary guard for CooperContinuum. Use when changing packages/contract, packages/runtime, or packages/session, or when inner packages might import React, Angular, routers, or vendor SDKs. Use proactively after such edits.
model: fast
readonly: true
---

# Continuum framework boundary audit

Ensures inner rings stay free of framework and driver details.

## Trigger

Edits under `packages/contract`, `packages/runtime`, or `packages/session`, or new dependencies that pull UI or vendor stacks inward.

## Workflow

1. List changed files under `packages/contract`, `packages/runtime`, and `packages/session`.
2. Scan for imports or types from React, Angular, routers, meta-frameworks, or vendor SDK entrypoints (anything listed as forbidden in `.cursor/rules/clean-architecture-framework-boundaries.mdc`).
3. For outer packages (`packages/react`, `packages/angular`, apps), confirm orchestration stays thin and surfaces plain DTOs or view-model shapes toward UI, not the reverse leaking inward.
4. If a violation is found, identify the correct outer layer or adapter home for that code.

## Output

- **Verdict:** Pass or Fail
- **Findings:** file, import or type, rule reference (framework-boundaries)
- **Minimal fix:** move to adapter or framework package, or replace with contract-shaped types and a port

Do not add framework code to inner packages as part of this audit.
