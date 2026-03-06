import type { ViewNode } from '@continuum/contract';
import { describe, expect, it } from 'vitest';
import { getScenarioById, scenarios } from './registry';

const supportedNodeTypes = new Set([
  'field',
  'select',
  'toggle',
  'action',
  'date',
  'textarea',
  'radio-group',
  'slider',
  'presentation',
  'group',
  'row',
  'grid',
  'collection',
  'telepathy-input',
  'quantum-slider',
]);

function readChildren(node: ViewNode): ViewNode[] {
  const nodeRecord = node as unknown as Record<string, unknown>;
  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    return Array.isArray(nodeRecord.children) ? (nodeRecord.children as ViewNode[]) : [];
  }
  if (node.type === 'collection') {
    const template = nodeRecord.template;
    return template && typeof template === 'object' ? [template as ViewNode] : [];
  }
  return [];
}

function assertNodeShape(node: ViewNode, seenPaths: Set<string>, parentPath = ''): void {
  expect(typeof node.id).toBe('string');
  expect(node.id.trim().length).toBeGreaterThan(0);
  expect(typeof node.type).toBe('string');
  expect(node.type.trim().length).toBeGreaterThan(0);
  expect(supportedNodeTypes.has(node.type)).toBe(true);

  if (node.key !== undefined) {
    expect(typeof node.key).toBe('string');
    expect(node.key.trim().length).toBeGreaterThan(0);
  }

  const nodePath = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
  expect(seenPaths.has(nodePath)).toBe(false);
  seenPaths.add(nodePath);

  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    const nodeRecord = node as unknown as Record<string, unknown>;
    expect(Array.isArray(nodeRecord.children)).toBe(true);
    expect((nodeRecord.children as unknown[]).length).toBeGreaterThan(0);
  }

  if (node.type === 'collection') {
    const nodeRecord = node as unknown as Record<string, unknown>;
    expect(nodeRecord.template).toBeTruthy();
    expect(typeof nodeRecord.template).toBe('object');
  }

  for (const child of readChildren(node)) {
    assertNodeShape(child, seenPaths, nodePath);
  }
}

describe('playground scenarios', () => {
  it('exposes unique scenarios and registry lookup', () => {
    expect(scenarios.length).toBeGreaterThan(0);
    const ids = scenarios.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const scenario of scenarios) {
      expect(getScenarioById(scenario.id)).toBe(scenario);
    }

    expect(getScenarioById('missing-scenario')).toBeUndefined();
  });

  it('has complete scenario and step metadata', () => {
    for (const scenario of scenarios) {
      expect(scenario.id.trim().length).toBeGreaterThan(0);
      expect(scenario.title.trim().length).toBeGreaterThan(0);
      expect(scenario.subtitle.trim().length).toBeGreaterThan(0);
      expect(scenario.capabilityTag.trim().length).toBeGreaterThan(0);
      expect(scenario.steps.length).toBeGreaterThan(0);

      const stepIds = scenario.steps.map((step) => step.id);
      expect(new Set(stepIds).size).toBe(stepIds.length);

      for (const [index, step] of scenario.steps.entries()) {
        expect(step.id.trim().length).toBeGreaterThan(0);
        expect(step.label).toBe(`Step ${index + 1}`);
        expect(step.description.trim().length).toBeGreaterThan(0);
        expect(step.narrativePrompt.trim().length).toBeGreaterThan(0);
        expect(step.view.viewId.trim().length).toBeGreaterThan(0);
        expect(step.view.version.trim().length).toBeGreaterThan(0);
        expect(step.view.nodes.length).toBeGreaterThan(0);
      }
    }
  });

  it('contains structurally valid view nodes for every step', () => {
    for (const scenario of scenarios) {
      for (const step of scenario.steps) {
        const seenPaths = new Set<string>();
        for (const node of step.view.nodes) {
          assertNodeShape(node, seenPaths);
        }
      }
    }
  });
});
