import type { SchemaSnapshot, ComponentDefinition } from '@continuum/contract';

type Mutation = (schema: SchemaSnapshot) => SchemaSnapshot;

function randomId(): string {
  return `hallucinated_${Math.random().toString(36).substring(2, 8)}`;
}

const NONSENSE_TYPES = [
  'quantum-slider',
  'neural-picker',
  'ai-sentiment-dial',
  'holographic-toggle',
  'telepathy-input',
  'blockchain-dropdown',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const renameRandomId: Mutation = (schema) => {
  const cloned = deepClone(schema);
  if (cloned.components.length === 0) return cloned;
  const target = pick(cloned.components);
  target.id = randomId();
  cloned.version = `${schema.version}-chaos-${Date.now()}`;
  return cloned;
};

const changeRandomType: Mutation = (schema) => {
  const cloned = deepClone(schema);
  if (cloned.components.length === 0) return cloned;
  const target = pick(cloned.components);
  target.type = pick(NONSENSE_TYPES);
  target.hash = `${target.type}:v1`;
  cloned.version = `${schema.version}-chaos-${Date.now()}`;
  return cloned;
};

const removeRandomComponent: Mutation = (schema) => {
  const cloned = deepClone(schema);
  if (cloned.components.length <= 1) return cloned;
  const removeIdx = Math.floor(Math.random() * cloned.components.length);
  cloned.components.splice(removeIdx, 1);
  cloned.version = `${schema.version}-chaos-${Date.now()}`;
  return cloned;
};

const wrapInContainer: Mutation = (schema) => {
  const cloned = deepClone(schema);
  if (cloned.components.length === 0) return cloned;
  const wrapIdx = Math.floor(Math.random() * cloned.components.length);
  const wrapped = cloned.components.splice(wrapIdx, 1)[0];
  const container: ComponentDefinition = {
    id: randomId(),
    type: 'container',
    key: `container-${wrapped.key ?? wrapped.id}`,
    children: [wrapped],
  };
  cloned.components.splice(wrapIdx, 0, container);
  cloned.version = `${schema.version}-chaos-${Date.now()}`;
  return cloned;
};

const mutations: Mutation[] = [
  renameRandomId,
  changeRandomType,
  removeRandomComponent,
  wrapInContainer,
];

export function hallucinate(schema: SchemaSnapshot): SchemaSnapshot {
  const mutation = pick(mutations);
  return mutation(schema);
}
