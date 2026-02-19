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

1. **Write tests first.** Before implementing anything, write the tests that define the expected behavior. Tests describe *what* the code should do, not *how*.
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

Condensed cheat sheet. Each item links to the full rule for details.

## Feature Isolation (critical)

Features (`packages/web/features/*`) are isolated. They NEVER import from each other. If a feature needs something from another domain, it goes through shared adapters and its own facade. Read `.cursor/rules/feature-isolation.mdc` for the full rule.

## Feature Facade Pattern

Components and pages import from their feature's facade files only:
- `./queries`, `./mutations`, `./adapters` -- never from `@global/*` or `@tanstack/*` directly.
- The facade is the only layer that touches global packages.
- Read `.cursor/rules/feature-architecture.mdc` for the full rule.

## Reference Implementation

Vendors (`packages/web/features/vendors`) is the reference feature. When unsure how something should be structured, check vendors first. But remember -- if your problem doesn't match what vendors does, don't force the pattern (see "Deciding: Follow a Pattern or Build Something New" above).

## Angular Conventions

- Signals over observables for component state.
- `inject()` over constructor injection.
- `ChangeDetectionStrategy.OnPush` on all components.
- No comments in code.
- Read `.cursor/rules/cursor.mdc` for the full list.

## Shared Utilities

Before building something from scratch, check if a shared package already provides it:
- `@master-detail-layout` -- layout components and list-page composables
- `@shared-lists` -- searchable list, sort/filter options
- `@shared-drawers` -- drawer components and utilities
- `@shared-feedback` -- alerts, confirmations, toasts

Read the package's `index.ts` to see what's exported.

## Skills

Before building something, check if there's a skill for it in `.cursor/skills/`. Skills contain step-by-step patterns for common tasks like adding drawers, configuring list pages, setting up features, and committing changes.
