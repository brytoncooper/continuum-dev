import {
  cloneView,
  collectNodeEntries,
  collectStatefulEntries,
  findNodeByCanonicalId,
} from './shared.mjs';

export function normalizeContinuumSemanticIdentity(args = {}) {
  const currentView = args.currentView;
  const nextView = args.nextView;

  if (!currentView || !nextView || !Array.isArray(nextView.nodes)) {
    return {
      view: nextView,
      errors: [],
    };
  }

  const priorEntries = collectStatefulEntries(currentView.nodes);
  const nextEntries = collectStatefulEntries(nextView.nodes);
  const errors = [];
  const clone = cloneView(nextView);

  const priorBySemanticKey = new Map();
  const nextBySemanticKey = new Map();
  const priorByKey = new Map();
  const usedIds = new Set(
    collectNodeEntries(clone.nodes).map((entry) => entry.id)
  );

  for (const entry of priorEntries) {
    if (entry.semanticKey && !priorBySemanticKey.has(entry.semanticKey)) {
      priorBySemanticKey.set(entry.semanticKey, entry);
    }
    if (entry.key && entry.semanticKey && !priorByKey.has(entry.key)) {
      priorByKey.set(entry.key, entry);
    }
  }

  for (const entry of nextEntries) {
    if (!entry.semanticKey) {
      continue;
    }

    if (nextBySemanticKey.has(entry.semanticKey)) {
      errors.push(
        `Duplicate semanticKey "${entry.semanticKey}" in generated view.`
      );
      continue;
    }
    nextBySemanticKey.set(entry.semanticKey, entry);
  }

  for (const entry of nextEntries) {
    if (entry.semanticKey) {
      const prior = priorBySemanticKey.get(entry.semanticKey);
      if (!prior || prior.id === entry.id) {
        continue;
      }

      if (usedIds.has(prior.id) && prior.id !== entry.id) {
        errors.push(
          `Generated view reused semanticKey "${entry.semanticKey}" but changed the node id from "${prior.id}" to "${entry.id}" while "${prior.id}" is already occupied.`
        );
        continue;
      }

      const targetNode = findNodeByCanonicalId(clone.nodes, entry.canonicalId);
      if (targetNode) {
        usedIds.delete(entry.id);
        targetNode.id = prior.id;
        usedIds.add(prior.id);
      }
      continue;
    }

    if (!entry.key) {
      continue;
    }

    const prior = priorByKey.get(entry.key);
    if (!prior) {
      continue;
    }

    errors.push(
      `Generated view reused "${entry.key}" without preserving semanticKey "${prior.semanticKey}".`
    );
  }

  return {
    view: clone,
    errors,
  };
}
