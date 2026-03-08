import type {
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type {
  PlaygroundScenario,
  PlaygroundScenarioInputField,
} from '../types';

function childNodes(node: ViewNode): ViewNode[] {
  if ('children' in node && Array.isArray(node.children)) {
    return node.children as ViewNode[];
  }

  return [];
}

function findNodeByKey(nodes: ViewNode[], trackedKey: string): ViewNode | null {
  for (const node of nodes) {
    if ('key' in node && node.key === trackedKey) {
      return node;
    }

    const nestedNode = findNodeByKey(childNodes(node), trackedKey);
    if (nestedNode) {
      return nestedNode;
    }
  }

  return null;
}

function findNodeByKeyInView(
  view: ViewDefinition,
  trackedKey: string
): ViewNode | null {
  return findNodeByKey(view.nodes, trackedKey);
}

function initialFieldKeys(
  scenario: PlaygroundScenario
): Array<{ key: string; label: string }> {
  if (scenario.inputFields?.length) {
    return scenario.inputFields.map((field) => ({
      key: field.key,
      label: field.label,
    }));
  }

  if (scenario.kind === 'state-drop') {
    return [
      { key: scenario.trackedField.key, label: scenario.trackedField.label },
    ];
  }

  return scenario.trackedFields.map((field) => ({
    key: field.key,
    label: field.label,
  }));
}

function placeholderForNode(node: ViewNode | null): string | undefined {
  if (node && 'placeholder' in node && typeof node.placeholder === 'string') {
    return node.placeholder;
  }

  return undefined;
}

function isMultilineNode(node: ViewNode | null): boolean {
  return Boolean(node && 'type' in node && node.type === 'textarea');
}

export function getScenarioInputFields(
  scenario: PlaygroundScenario
): PlaygroundScenarioInputField[] {
  if (scenario.inputFields?.length) {
    return scenario.inputFields;
  }

  const initialView = scenario.steps[0].view;

  return initialFieldKeys(scenario).map((field) => {
    const node = findNodeByKeyInView(initialView, field.key);

    return {
      key: field.key,
      label: field.label,
      placeholder: placeholderForNode(node),
      multiline: isMultilineNode(node),
    };
  });
}

export function getScenarioDefaultInputValues(
  scenario: PlaygroundScenario
): Record<string, string> {
  if (scenario.defaultInputValues) {
    return scenario.defaultInputValues;
  }

  if (scenario.kind === 'state-drop') {
    return {
      [scenario.trackedField.key]: scenario.controls.inputValue ?? '',
    };
  }

  return Object.fromEntries(
    Object.entries(scenario.initialValues).map(([key, value]) => [
      key,
      typeof value.value === 'string' ? value.value : String(value.value ?? ''),
    ])
  );
}

export function buildSeedValues(
  baseValues: Record<string, NodeValue>,
  inputValues: Record<string, string>
): Record<string, NodeValue> {
  return Object.fromEntries(
    Object.entries(baseValues).map(([key, value]) => [
      key,
      {
        ...value,
        value:
          inputValues[key] ??
          (typeof value.value === 'string'
            ? value.value
            : String(value.value ?? '')),
        isDirty: true,
      },
    ])
  );
}
