import type { ViewDefinition } from '@continuum/contract';
import type { ViewPatch, PatchOperation } from './types';

export function applyPatch(currentView: ViewDefinition, patch: ViewPatch): ViewDefinition {
  const nextView = JSON.parse(JSON.stringify(currentView)) as ViewDefinition;
  
  if (patch.viewId) nextView.viewId = patch.viewId;
  if (patch.version) nextView.version = patch.version;

  if (Array.isArray(patch.operations)) {
    for (const op of patch.operations) {
      applyOperation(nextView, op);
    }
  }

  return nextView;
}

function applyOperation(view: any, op: PatchOperation) {
  const parts = op.path.split('/').filter(Boolean);
  if (parts.length === 0) return;
  
  let current = view;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (Array.isArray(current)) {
      current = current[parseInt(part, 10)];
    } else {
      current = current[part];
    }
    if (current === undefined || current === null) return;
  }

  const lastPart = parts[parts.length - 1];
  
  if (Array.isArray(current)) {
    if (op.op === 'add') {
      if (lastPart === '-') {
        current.push(op.value);
      } else {
        current.splice(parseInt(lastPart, 10), 0, op.value);
      }
    } else if (op.op === 'remove') {
      current.splice(parseInt(lastPart, 10), 1);
    } else if (op.op === 'replace') {
      current[parseInt(lastPart, 10)] = op.value;
    }
  } else {
    if (op.op === 'add' || op.op === 'replace') {
      current[lastPart] = op.value;
    } else if (op.op === 'remove') {
      delete current[lastPart];
    }
  }
}
