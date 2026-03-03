import type { ViewDefinition, ViewNode } from '@continuum/contract';

type Mutation = (view: ViewDefinition) => ViewDefinition;

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

const renameRandomId: Mutation = (view) => {
  const cloned = deepClone(view);
  if (cloned.nodes.length === 0) return cloned;
  const target = pick(cloned.nodes);
  if (!target.key) {
    target.key = target.id;
  }
  target.id = randomId();
  cloned.version = `${view.version}-chaos-${Date.now()}`;
  return cloned;
};

const renameRandomIdAndKey: Mutation = (view) => {
  const cloned = deepClone(view);
  if (cloned.nodes.length === 0) return cloned;
  const target = pick(cloned.nodes);
  target.id = randomId();
  target.key = randomId();
  cloned.version = `${view.version}-chaos-${Date.now()}`;
  return cloned;
};

const changeRandomType: Mutation = (view) => {
  const cloned = deepClone(view);
  if (cloned.nodes.length === 0) return cloned;
  const target = pick(cloned.nodes);
  target.type = pick(NONSENSE_TYPES);
  target.hash = `${target.type}:v1`;
  cloned.version = `${view.version}-chaos-${Date.now()}`;
  return cloned;
};

const removeRandomNode: Mutation = (view) => {
  const cloned = deepClone(view);
  if (cloned.nodes.length <= 1) return cloned;
  const removeIdx = Math.floor(Math.random() * cloned.nodes.length);
  cloned.nodes.splice(removeIdx, 1);
  cloned.version = `${view.version}-chaos-${Date.now()}`;
  return cloned;
};

const wrapInGroup: Mutation = (view) => {
  const cloned = deepClone(view);
  if (cloned.nodes.length === 0) return cloned;
  const wrapIdx = Math.floor(Math.random() * cloned.nodes.length);
  const wrapped = cloned.nodes.splice(wrapIdx, 1)[0];
  const group: ViewNode = {
    id: randomId(),
    type: 'group',
    key: `group-${wrapped.key ?? wrapped.id}`,
    children: [wrapped],
  } as ViewNode;
  cloned.nodes.splice(wrapIdx, 0, group);
  cloned.version = `${view.version}-chaos-${Date.now()}`;
  return cloned;
};

const mutations: Mutation[] = [
  renameRandomId,
  renameRandomIdAndKey,
  changeRandomType,
  removeRandomNode,
  wrapInGroup,
];

export function hallucinate(view: ViewDefinition): ViewDefinition {
  const mutation = pick(mutations);
  return mutation(view);
}
