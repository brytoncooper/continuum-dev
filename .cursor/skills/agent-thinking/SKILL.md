---
name: agent-thinking
description: Reasoning habits, investigation patterns, and TDD workflow for producing better code changes. Teaches how to investigate before coding, when to follow vs. deviate from existing patterns, and how to handle ambiguity. This skill applies to ALL tasks -- always follow these habits.
---

# How to Think Before You Code

## Investigate Before Writing

- **Read before you write.** Always read the file you're about to change. Read files that import from it and files it imports from. Understand the context you're working in.
- **Understand the boundaries.** Identify what module, feature, or package you're in. Check if there are rules about what can import what. Read any `.cursor/rules/` files that apply.
- **Trace the data flow.** Where does the data come from? How is it transformed? Where is it consumed? Follow the full path before changing any part of it.
- **Check for ripple effects.** After planning a change, search for every consumer of the thing you're changing. Verify nothing breaks downstream.
- **Scope your changes minimally.** Only change what the user asked for. If you discover something else that needs fixing, mention it to the user -- don't silently fix it or expand scope.

## Deciding: Follow a Pattern or Build Something New

This is the key judgment call. Do not default to either extreme.

1. **Search for similar code first.** Look for existing implementations that solve a similar problem. This is about understanding how the codebase handles this kind of thing, not about blindly copying.
2. **If a clear pattern exists and fits your case:** Follow it closely. Consistency matters more than cleverness.
3. **If a pattern exists but doesn't quite fit:** Adapt it. Use the parts that apply, deviate where the problem genuinely differs. Explain to the user why you're deviating.
4. **If no pattern exists:** That's fine. You're building something new. Design it to be consistent with the codebase's style and conventions, but do not force-fit an unrelated pattern just to have a reference. Tell the user this is new ground.
5. **If a pattern exists but it's bad:** Do not replicate a bad pattern. Mention the existing approach to the user and explain why a different approach would be better. Let them decide.

**The trap to avoid:** forcing a reference onto a problem it doesn't match. A bad analogy is worse than no analogy. If you find yourself bending a reference to fit, stop and consider whether you're actually solving a different problem.

## Test-Driven Development

This project follows TDD. The workflow has a hard stop between tests and implementation.

### The TDD cycle

1. **Write tests first.** Before implementing anything, write the tests that define the expected behavior. Tests describe _what_ the code should do, not _how_.
2. **STOP.** Present the tests to the user for review. Do NOT write any implementation code. Wait for the user to review, adjust, and commit the tests.
3. **Implement after tests are committed.** Once the user confirms the tests, proceed with implementation. The committed tests are now the contract.
4. **NEVER modify committed tests to make implementation pass.** If the implementation doesn't satisfy the tests, fix the implementation. If you genuinely believe a test is wrong, explain why to the user and let them decide -- do not change it yourself.

### Why this order is mandatory

If tests and implementation are written together, there is a natural pull to adjust tests to match what the code actually does rather than what it should do. Committing tests first removes that temptation entirely. The tests become an independent specification.

## Planning Multi-Step Tasks

- Break the task into a todo list before starting.
- Identify dependencies between steps. What must come before what?
- Do foundational work first (types, shared utilities), then consumers (features, components).
- For each step: **tests first (stop for review) -> implementation -> verify tests pass**.

## When You're Uncertain

- Search for the error message or symbol in the codebase.
- Read the imports of the file you're working in to understand what's available.
- Check the package's `index.ts` to see what's exported.
- Look at tests or usage examples for the API you're trying to use.
- **If you're unsure about a design decision, surface the ambiguity to the user.** Say what you know, what you don't know, and what the options are. Do not guess silently.

---

# This Project's Conventions

Condensed cheat sheet for CooperContinuum. Full detail lives under `.cursor/rules/`.

## Nx and import boundaries

- Allowed **cross-library imports** are defined only by `@nx/enforce-module-boundaries` → `depConstraints` in `eslint.config.mjs`. Before adding an import or dependency, confirm source and target `nx.tags` satisfy those constraints.
- Ring names and tag meanings are summarized in `.cursor/rules/clean-architecture-layer-mapping.mdc`. Use it to reason about direction; do not treat it as overriding ESLint.

## Inner packages stay framework-free

- `packages/contract`, `packages/runtime`, and `packages/session` must not depend on React, Angular, routers, or vendor SDKs. UI and integrations live in outer packages and apps. See `.cursor/rules/clean-architecture-framework-boundaries.mdc`.

## Ports and payloads

- When inner code needs the outside world, depend on a **port** (narrow interface or callback) with **contract-shaped** types, not vendor types. See `.cursor/rules/clean-architecture-dependency-inversion.mdc` and `.cursor/rules/clean-code-modules-and-objects.mdc`.

## Tests and public API

- Prove behavior through **public package surfaces** or ports with fakes; avoid coupling to private modules or incidental UI structure. See `.cursor/rules/clean-architecture-test-boundaries.mdc` and `.cursor/rules/clean-code-tests.mdc`.
- Add **TSDoc** on **exported** symbols that are part of a package's public consumer surface, per `.cursor/rules/public-api-docs.mdc`.

## Serialization (v0)

- This repo is v0 pre-release. Follow `.cursor/rules/version-context.mdc` for `formatVersion` and avoid extra migration machinery until v1.

## Subagents and skills

- Specialized audits live as subagents in `.cursor/agents/` (for example `continuum-nx-boundary-audit`, `continuum-framework-boundary-audit`). Invoke when you need an isolated review pass.
- Workflow skills live in `.cursor/skills/` (for example `staged-commit`). Use them when the task matches their description.
