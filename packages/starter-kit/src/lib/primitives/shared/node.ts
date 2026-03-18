import type { FieldOption, ViewNode } from '@continuum-dev/contract';

export function readNodeProp<T>(
  definition: ViewNode,
  key: string
): T | undefined {
  return (definition as unknown as Record<string, unknown>)[key] as
    | T
    | undefined;
}

export function nodeLabel(definition: ViewNode): string | undefined {
  const label = readNodeProp<string>(definition, 'label');
  if (typeof label !== 'string') {
    return undefined;
  }
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function nodeDescription(definition: ViewNode): string | undefined {
  return readNodeProp<string>(definition, 'description');
}

export function nodePlaceholder(definition: ViewNode): string | undefined {
  return readNodeProp<string>(definition, 'placeholder');
}

export function nodeOptions(definition: ViewNode): FieldOption[] {
  const directOptions = readNodeProp<FieldOption[]>(definition, 'options');
  if (Array.isArray(directOptions)) {
    return directOptions;
  }
  const props = readNodeProp<Record<string, unknown>>(definition, 'props');
  const nestedOptions = props?.options;
  if (Array.isArray(nestedOptions)) {
    return nestedOptions as FieldOption[];
  }
  return [];
}

export function nodeOptionKey(option: FieldOption, index: number): string {
  return `${option.value}:${option.label}:${index}`;
}

export function nodeNumberProp(
  definition: ViewNode,
  key: string,
  fallback: number
): number {
  const directValue = readNodeProp<number>(definition, key);
  if (typeof directValue === 'number') {
    return directValue;
  }
  const props = readNodeProp<Record<string, unknown>>(definition, 'props');
  if (typeof props?.[key] === 'number') {
    return props[key] as number;
  }
  return fallback;
}

export function nodeDepth(nodeId?: string): number {
  if (!nodeId) {
    return 0;
  }
  return nodeId.split('/').length - 1;
}
