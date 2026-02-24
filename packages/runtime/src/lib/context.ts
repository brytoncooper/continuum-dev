import type { ComponentDefinition, SchemaSnapshot, StateSnapshot } from '@continuum/contract';

export interface ReconciliationContext {
  newSchema: SchemaSnapshot;
  priorSchema: SchemaSnapshot | null;
  newById: Map<string, ComponentDefinition>;
  newByKey: Map<string, ComponentDefinition>;
  priorById: Map<string, ComponentDefinition>;
  priorByKey: Map<string, ComponentDefinition>;
}

export function buildReconciliationContext(
  newSchema: SchemaSnapshot,
  priorSchema: SchemaSnapshot | null
): ReconciliationContext {
  const newById = new Map<string, ComponentDefinition>();
  const newByKey = new Map<string, ComponentDefinition>();
  const priorById = new Map<string, ComponentDefinition>();
  const priorByKey = new Map<string, ComponentDefinition>();

  function indexComponents(
    comps: ComponentDefinition[],
    byId: Map<string, ComponentDefinition>,
    byKey: Map<string, ComponentDefinition>,
    pathPrefix = ''
  ) {
    for (const comp of comps) {
      byId.set(comp.id, comp);
      if (comp.key) {
        byKey.set(comp.key, comp);
      }
      if (comp.children) {
        indexComponents(comp.children, byId, byKey, pathPrefix);
      }
    }
  }

  indexComponents(newSchema.components, newById, newByKey);
  if (priorSchema) {
    indexComponents(priorSchema.components, priorById, priorByKey);
  }

  return {
    newSchema,
    priorSchema,
    newById,
    newByKey,
    priorById,
    priorByKey,
  };
}

export function findPriorComponent(
  ctx: ReconciliationContext,
  newComponent: ComponentDefinition
): ComponentDefinition | null {
  const byId = ctx.priorById.get(newComponent.id);
  if (byId) return byId;

  if (newComponent.key) {
    const byKey = ctx.priorByKey.get(newComponent.key);
    if (byKey) return byKey;
  }

  return null;
}

export function buildPriorValueMap(
  priorState: StateSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [priorId, priorValue] of Object.entries(priorState.values)) {
    map.set(priorId, priorValue);
    const priorComp = ctx.priorById.get(priorId);
    if (priorComp?.key) {
      const newComp = ctx.newByKey.get(priorComp.key);
      if (newComp) map.set(newComp.id, priorValue);
    }
  }
  return map;
}

export function determineMatchType(
  ctx: ReconciliationContext,
  newComponent: ComponentDefinition,
  priorComponent: ComponentDefinition | null
): 'id' | 'key' | null {
  if (!priorComponent) return null;
  return ctx.priorById.has(newComponent.id) ? 'id' : 'key';
}
