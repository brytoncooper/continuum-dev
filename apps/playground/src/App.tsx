import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewDefinition, ViewNode, NodeValue } from '@continuum/contract';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumDiagnostics,
  useContinuumHydrated,
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumSuggestions,
} from '@continuum/react';
import type { SessionOptions } from '@continuum/session';
import { generateView } from './ai/client';
import {
  buildCorrectionMessages,
  buildEvolutionMessages,
  buildInitialMessages,
  getSystemPrompt,
} from './ai/prompt-builder';
import { aiProviders } from './ai/registry';
import type { AIConversationEntry, AIAttachment, ProviderId } from './ai/types';
import { validateView } from './ai/validate-view';
import { hallucinate } from './chaos';
import { componentMap, liveAiComponentMap } from './component-map';
import { scenarios } from './scenarios/registry';
import type { ScenarioStep } from './scenarios/types';
import { AIControlCard } from './ui/controls/AIControlCard';
import { LandingPage } from './ui/landing/LandingPage';
import { ScenarioContextCard } from './ui/controls/ScenarioContextCard';
import { StoryHeader } from './ui/controls/StoryHeader';
import { DevtoolsTabs } from './ui/devtools/DevtoolsTabs';
import { globalStyles } from './ui/global-styles';
import { ReconciliationToast } from './ui/feedback/ReconciliationToast';
import { RefreshBanner } from './ui/feedback/RefreshBanner';
import { TraceAnimations } from './ui/feedback/TraceAnimations';
import { ValueCallout } from './ui/feedback/ValueCallout';
import { AppShell } from './ui/layout/AppShell';
import { MainStage } from './ui/layout/MainStage';

type ProtocolMode = 'native' | 'a2ui';

const defaultScenarioId = scenarios[0]?.id ?? '';

const sessionOptions: SessionOptions = {
  reconciliation: {
    strategyRegistry: {
      'email-v1-to-v2': (_nodeId, _priorNode, _newNode, priorValue) => priorValue,
      'date-v1-to-v2': (_nodeId, _priorNode, _newNode, priorValue) => priorValue,
    },
  },
  validateOnUpdate: true,
  actions: {
    'form.exportPdf': {
      registration: {
        label: 'Export to PDF',
        description: 'Generates a PDF of the current form values',
        icon: 'pdf',
      },
      handler: (context) => {
        const values = context.snapshot.values;
        const data = Object.entries(values)
          .map(([k, v]) => `${k}: ${v.value}`)
          .join('\n');
        context.session.updateState('form.exportPdf', { value: `Exported at ${new Date().toISOString()}` });
        return { success: true, data };
      },
    },
    'form.submitDraft': {
      registration: {
        label: 'Submit Draft',
        description: 'Simulates an async form submission',
        icon: 'send',
      },
      handler: async (context) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const fieldCount = Object.keys(context.snapshot.values).length;
        return { success: true, data: { fieldCount, submittedAt: new Date().toISOString() } };
      },
    },
  },
};

function collectDefaultValues(nodes: ViewNode[], output: Record<string, unknown>, parentPath = ''): void {
  for (const node of nodes) {
    const nodeRecord = node as unknown as Record<string, unknown>;
    const nodeType = typeof nodeRecord.type === 'string' ? nodeRecord.type : '';
    const fullId = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
    const hasDefault = Object.prototype.hasOwnProperty.call(nodeRecord, 'defaultValue');
    if (
      hasDefault &&
      nodeType !== 'group' &&
      nodeType !== 'collection' &&
      nodeType !== 'action' &&
      nodeType !== 'presentation'
    ) {
      output[fullId] = nodeRecord.defaultValue;
    }

    if ((nodeType === 'group' || nodeType === 'row' || nodeType === 'grid') && Array.isArray(nodeRecord.children)) {
      // Handle group-level defaultValues: { key1: value1, key2: value2 }
      if (nodeType === 'group') {
        const groupDefaults = nodeRecord.defaultValues as Record<string, unknown> | undefined;
        if (groupDefaults && typeof groupDefaults === 'object' && !Array.isArray(groupDefaults)) {
          const children = nodeRecord.children as ViewNode[];
          for (const child of children) {
            const childRecord = child as unknown as Record<string, unknown>;
            const childKey = typeof childRecord.key === 'string' ? childRecord.key : '';
            const childFullId = fullId.length > 0 ? `${fullId}/${child.id}` : child.id;
            if (childKey && Object.prototype.hasOwnProperty.call(groupDefaults, childKey)) {
              output[childFullId] = groupDefaults[childKey];
            }
          }
        }
      }
      collectDefaultValues(nodeRecord.children as ViewNode[], output, fullId);
    }
  }
}

function shouldSeedCollectionDefaultsFromPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return (
    normalized.includes('default') ||
    normalized.includes('prepop') ||
    normalized.includes('populate') ||
    normalized.includes('seed') ||
    normalized.includes('handful') ||
    normalized.includes('couple')
  );
}

function collectCollectionKeys(nodes: ViewNode[], output: Set<string>): void {
  for (const node of nodes) {
    const nodeRecord = node as unknown as Record<string, unknown>;
    const nodeType = typeof nodeRecord.type === 'string' ? nodeRecord.type : '';
    const nodeKey = typeof nodeRecord.key === 'string' ? nodeRecord.key : '';
    if (nodeType === 'collection' && nodeKey) {
      output.add(nodeKey);
    }
    if (nodeType === 'group' && Array.isArray(nodeRecord.children)) {
      collectCollectionKeys(nodeRecord.children as ViewNode[], output);
    }
    if (nodeType === 'collection' && nodeRecord.template && typeof nodeRecord.template === 'object') {
      const template = nodeRecord.template as ViewNode;
      if (template.type === 'group') {
        const templateRecord = template as unknown as Record<string, unknown>;
        if (Array.isArray(templateRecord.children)) {
          collectCollectionKeys(templateRecord.children as ViewNode[], output);
        }
      }
    }
  }
}

function detectDroppedCollectionKeys(
  currentView: ViewDefinition,
  nextView: ViewDefinition
): string[] {
  const currentKeys = new Set<string>();
  const nextKeys = new Set<string>();
  collectCollectionKeys(currentView.nodes ?? [], currentKeys);
  collectCollectionKeys(nextView.nodes ?? [], nextKeys);
  return [...currentKeys].filter((key) => !nextKeys.has(key));
}

function allowsCollectionRestructure(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return (
    normalized.includes('replace') ||
    normalized.includes('remove') ||
    normalized.includes('delete') ||
    normalized.includes('rename') ||
    normalized.includes('split') ||
    normalized.includes('separate') ||
    normalized.includes('restructure') ||
    normalized.includes('break into') ||
    normalized.includes('group by')
  );
}

/**
 * Detect when the AI model returns a flat array of nodes instead of a nested
 * tree. This typically happens with GPT-5.2 on follow-up prompts where it loses
 * context about the hierarchy and emits every node at the top level.
 */
function isLikelyFlatArray(view: ViewDefinition): boolean {
  if (!Array.isArray(view.nodes) || view.nodes.length <= 1) return false;
  const topNodes = view.nodes as unknown as Record<string, unknown>[];
  const nodesWithChildren = topNodes.filter(
    (n) =>
      (Array.isArray(n.children) && (n.children as unknown[]).length > 0) ||
      (n.template != null && typeof n.template === 'object')
  );
  // A properly nested view usually has 1 root node with children. If we have
  // ≥ 5 top-level nodes and fewer than 30% have children, flag it.
  if (topNodes.length >= 5 && nodesWithChildren.length / topNodes.length < 0.3) {
    return true;
  }
  return false;
}

interface TemplateValueTarget {
  path: string;
  id: string;
  key?: string;
  collectionTemplate?: ViewNode;
}

function collectTemplateValueTargets(
  node: ViewNode,
  output: TemplateValueTarget[],
  parentPath = ''
): void {
  const nodeId = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
  // Recurse into group, row, and grid nodes to discover nested children
  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    const nodeRecord = node as unknown as Record<string, unknown>;
    if (Array.isArray(nodeRecord.children)) {
      for (const child of nodeRecord.children as ViewNode[]) {
        collectTemplateValueTargets(child, output, nodeId);
      }
    }
    return;
  }
  if (node.type === 'collection') {
    const nodeRecord = node as unknown as Record<string, unknown>;
    const nestedTemplate = nodeRecord.template as ViewNode | undefined;
    output.push({ path: nodeId, id: node.id, key: node.key, collectionTemplate: nestedTemplate });
    return;
  }
  output.push({ path: nodeId, id: node.id, key: node.key });
}

function normalizeCollectionSeedItem(
  rawItem: unknown,
  template: ViewNode
): Record<string, NodeValue> {
  if (rawItem === null || rawItem === undefined) {
    return {};
  }
  if (
    template.type !== 'group' &&
    template.type !== 'collection' &&
    (typeof rawItem === 'string' || typeof rawItem === 'number' || typeof rawItem === 'boolean')
  ) {
    return { [template.id]: { value: rawItem } as NodeValue };
  }
  if (typeof rawItem !== 'object') {
    return {};
  }
  const objectItem = rawItem as Record<string, unknown>;
  const targets: TemplateValueTarget[] = [];
  collectTemplateValueTargets(template, targets);
  const values: Record<string, NodeValue> = {};
  const byPath = new Map<string, TemplateValueTarget>();
  const byId = new Map<string, TemplateValueTarget>();
  const byKey = new Map<string, TemplateValueTarget>();
  for (const target of targets) {
    byPath.set(target.path, target);
    byId.set(target.id, target);
    if (target.key) {
      byKey.set(target.key, target);
    }
  }
  for (const [entryKey, entryValue] of Object.entries(objectItem)) {
    if (entryKey === 'id') {
      continue;
    }
    const target =
      byPath.get(entryKey) ??
      byId.get(entryKey) ??
      byKey.get(entryKey);
    if (!target) {
      continue;
    }
    const collectionTemplate = target.collectionTemplate;
    if (collectionTemplate && Array.isArray(entryValue)) {
      const nestedItems = entryValue.map((nestedRaw) => ({
        values: normalizeCollectionSeedItem(nestedRaw, collectionTemplate),
      }));
      values[target.path] = { value: { items: nestedItems } } as NodeValue;
    } else {
      values[target.path] = { value: entryValue } as NodeValue;
    }
  }
  if (Object.keys(values).length === 0 && template.type !== 'group') {
    const fallback =
      objectItem[template.key ?? ''] ??
      objectItem[template.id] ??
      objectItem.value;
    if (fallback !== undefined) {
      values[template.id] = { value: fallback } as NodeValue;
    }
  }
  return values;
}

function clampCollectionSeedCount(
  requested: number,
  maxItems: number | undefined
): number {
  if (requested <= 0) {
    return 0;
  }
  if (maxItems === undefined) {
    return requested;
  }
  return Math.min(requested, maxItems);
}

function collectCollectionSeeds(
  nodes: ViewNode[],
  output: Record<string, NodeValue>,
  explicitIds: Set<string>,
  includeOptionFallback: boolean,
  parentPath = ''
): void {
  for (const node of nodes) {
    const nodeRecord = node as unknown as Record<string, unknown>;
    const nodeType = typeof nodeRecord.type === 'string' ? nodeRecord.type : '';
    const nodeId = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
    if ((nodeType === 'group' || nodeType === 'row' || nodeType === 'grid') && Array.isArray(nodeRecord.children)) {
      collectCollectionSeeds(
        nodeRecord.children as ViewNode[],
        output,
        explicitIds,
        includeOptionFallback,
        nodeId
      );
      continue;
    }
    if (nodeType !== 'collection') {
      continue;
    }
    const template = nodeRecord.template as Record<string, unknown> | undefined;
    if (!template || typeof template.id !== 'string') {
      continue;
    }
    const maxItemsRaw = typeof nodeRecord.maxItems === 'number' ? Math.floor(nodeRecord.maxItems) : undefined;
    const maxItems = maxItemsRaw !== undefined && maxItemsRaw >= 0 ? maxItemsRaw : undefined;
    const collectionDefaults = Array.isArray(nodeRecord.defaultValues)
      ? (nodeRecord.defaultValues as unknown[])
      : undefined;
    const templateDefaults = Array.isArray(template.defaultValues)
      ? (template.defaultValues as unknown[])
      : undefined;
    const sourceDefaults = collectionDefaults ?? templateDefaults;
    if (sourceDefaults && sourceDefaults.length > 0) {
      const seedCount = clampCollectionSeedCount(sourceDefaults.length, maxItems);
      const items = sourceDefaults
        .slice(0, seedCount)
        .map((rawItem) => ({
          values: normalizeCollectionSeedItem(rawItem, template as unknown as ViewNode),
        }));
      output[nodeId] = {
        value: { items },
      } as NodeValue;
      explicitIds.add(nodeId);
      continue;
    }
    if (!includeOptionFallback) {
      continue;
    }
    const templateType = typeof template.type === 'string' ? template.type : '';
    if (templateType !== 'select' && templateType !== 'radio-group') {
      continue;
    }
    const options = Array.isArray(template.options)
      ? (template.options as Array<Record<string, unknown>>)
      : [];
    const normalizedOptions = options
      .map((option) => {
        if (!option || typeof option !== 'object') {
          return '';
        }
        const value = option.value;
        return typeof value === 'string' && value.length > 0 ? value : '';
      })
      .filter((value) => value.length > 0);
    const seedCount = clampCollectionSeedCount(
      Math.min(normalizedOptions.length, 3),
      maxItems
    );
    if (seedCount <= 0) {
      continue;
    }
    output[nodeId] = {
      value: {
        items: normalizedOptions.slice(0, seedCount).map((value) => ({
          values: {
            [template.id as string]: { value } as NodeValue,
          },
        })),
      },
    } as NodeValue;
  }
}

function applyViewDefaults(session: ReturnType<typeof useContinuumSession>, view: ViewDefinition): void {
  const defaults: Record<string, unknown> = {};
  collectDefaultValues(view.nodes ?? [], defaults);
  if (Object.keys(defaults).length === 0) {
    return;
  }

  const existingValues = session.getSnapshot()?.data.values ?? {};
  const resolutions = session.getResolutions();
  const reconciledNodeIds = new Set(
    resolutions
      .filter((r) => r.resolution === 'carried' || r.resolution === 'migrated' || r.resolution === 'restored')
      .map((r) => r.nodeId)
  );
  for (const [nodeId, defaultValue] of Object.entries(defaults)) {
    if (existingValues[nodeId] === undefined && !reconciledNodeIds.has(nodeId)) {
      // Brand-new node with no value — apply default immediately
      session.updateState(nodeId, { value: defaultValue } as NodeValue);
    } else if (reconciledNodeIds.has(nodeId)) {
      // Carried/migrated node — if the user has edited it, show as a suggestion;
      // otherwise apply the AI value directly.
      const existing = existingValues[nodeId] as NodeValue | undefined;
      if (existing?.isDirty) {
        // Field has been touched by the user — store AI value as a suggestion
        session.updateState(nodeId, {
          ...existing,
          suggestion: defaultValue,
        } as NodeValue);
      } else {
        // Field is clean — apply AI value directly without interrupting the user
        session.updateState(nodeId, { value: defaultValue } as NodeValue);
      }
    }
  }
}



function applyCollectionOptionSeeds(
  session: ReturnType<typeof useContinuumSession>,
  view: ViewDefinition,
  includeOptionFallback: boolean
): void {
  const seeds: Record<string, NodeValue> = {};
  const explicitIds = new Set<string>();
  collectCollectionSeeds(view.nodes ?? [], seeds, explicitIds, includeOptionFallback);
  if (Object.keys(seeds).length === 0) {
    return;
  }
  const existingValues = session.getSnapshot()?.data.values ?? {};
  for (const [nodeId, nodeValue] of Object.entries(seeds)) {
    if (explicitIds.has(nodeId)) {
      const existingExplicit = existingValues[nodeId] as NodeValue<{ items?: unknown[] }> | undefined;
      const existingExplicitItems = existingExplicit && typeof existingExplicit === 'object'
        ? existingExplicit.value?.items
        : undefined;
      const canSeedExplicit =
        existingValues[nodeId] === undefined ||
        (Array.isArray(existingExplicitItems) && existingExplicitItems.length === 0);
      if (canSeedExplicit) {
        session.proposeValue(nodeId, nodeValue, 'ai');
      }
      continue;
    }
    const existing = existingValues[nodeId] as NodeValue<{ items?: unknown[] }> | undefined;
    const existingItems = existing && typeof existing === 'object'
      ? existing.value?.items
      : undefined;
    const canSeed =
      existingValues[nodeId] === undefined ||
      (Array.isArray(existingItems) && existingItems.length === 0);
    if (canSeed) {
      session.proposeValue(nodeId, nodeValue, 'ai');
    }
  }
}

interface PlaygroundContentProps {
  onBackToIntro: () => void;
  routeScenarioId: string;
  onScenarioRouteChange: (scenarioId: string) => void;
  onAiModeRouteChange: () => void;
}

function PlaygroundContent({
  onBackToIntro,
  routeScenarioId,
  onScenarioRouteChange,
  onAiModeRouteChange,
}: PlaygroundContentProps) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const { issues, diffs, resolutions, checkpoints } = useContinuumDiagnostics();
  const wasHydrated = useContinuumHydrated();

  const [selectedScenarioId, setSelectedScenarioId] = useState(routeScenarioId);
  const [stepIndex, setStepIndex] = useState(-1);
  const [protocolMode, setProtocolMode] = useState<ProtocolMode>('native');
  const initializedRef = useRef(false);
  const scenarioEffectReadyRef = useRef(false);

  useEffect(() => {
    if (routeScenarioId === selectedScenarioId) {
      return;
    }
    session.reset();
    setSelectedScenarioId(routeScenarioId);
    setProtocolMode('native');
    setStepIndex(0);
  }, [routeScenarioId, selectedScenarioId, session]);

  const selectedScenario = useMemo(() => {
    return scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  }, [selectedScenarioId]);

  const activeSteps = useMemo<ScenarioStep[]>(() => {
    if (!selectedScenario) {
      return [];
    }
    return selectedScenario.steps;
  }, [selectedScenario]);

  const pushStep = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(activeSteps.length - 1, index));
      const step = activeSteps[clamped];
      if (!step) {
        return;
      }
      session.pushView(step.view as ViewDefinition);
      applyViewDefaults(session, step.view as ViewDefinition);
      if (step.initialState && clamped === 0) {
        const existingValues = session.getSnapshot()?.data.values ?? {};
        for (const [nodeId, value] of Object.entries(step.initialState)) {
          if (existingValues[nodeId] === undefined) {
            session.updateState(nodeId, value);
          }
        }
      }
      setStepIndex(clamped);
    },
    [activeSteps, session]
  );

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    const existing = session.getSnapshot();
    if (!existing) {
      pushStep(0);
      return;
    }
    const index = activeSteps.findIndex((step) => step.view.version === existing.view.version);
    if (index >= 0) {
      setStepIndex(index);
      return;
    }
    pushStep(activeSteps.length - 1);
  }, [activeSteps, pushStep, session]);

  const handleScenarioSelect = useCallback(
    (scenarioId: string) => {
      if (scenarioId === selectedScenarioId) {
        return;
      }
      onScenarioRouteChange(scenarioId);
    },
    [onScenarioRouteChange, selectedScenarioId]
  );

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }
    if (!scenarioEffectReadyRef.current) {
      scenarioEffectReadyRef.current = true;
      return;
    }
    pushStep(0);
  }, [selectedScenarioId, protocolMode, pushStep]);

  const handleRewind = useCallback(
    (checkpointId: string) => {
      session.rewind(checkpointId);
      const updatedSnapshot = session.getSnapshot();
      if (!updatedSnapshot) {
        setStepIndex(-1);
        return;
      }
      const matchedIndex = activeSteps.findIndex(
        (step) => step.view.version === updatedSnapshot.view.version
      );
      setStepIndex(matchedIndex);
    },
    [activeSteps, session]
  );
  const handleCreateCheckpoint = useCallback(() => {
    if (!session.getSnapshot()) {
      return;
    }
    session.checkpoint();
  }, [session]);

  const handleHallucinate = useCallback(() => {
    const activeView = session.getSnapshot()?.view;
    if (!activeView) {
      return;
    }
    session.pushView(hallucinate(activeView));
  }, [session]);

  const currentStep = activeSteps[Math.max(0, stepIndex)] ?? null;
  const detachedValues = snapshot?.data.detachedValues ?? {};
  if (!selectedScenario) {
    return null;
  }
  if (!currentStep && !wasHydrated) {
    return null;
  }

  return (
    <>
      <TraceAnimations resolutions={resolutions} />
      <ReconciliationToast resolutions={resolutions} />
      <AppShell
        header={
          <StoryHeader
            onBackToIntro={onBackToIntro}
            scenarios={scenarios}
            activeScenarioId={selectedScenario.id}
            activeScenarioTitle={
              protocolMode === 'a2ui' ? 'A2UI Protocol Mode' : selectedScenario.title
            }
            activeScenarioSubtitle={
              protocolMode === 'a2ui' ? 'Adapter-generated view walkthrough' : selectedScenario.subtitle
            }
            protocolMode={protocolMode}
            checkpointCount={checkpoints.length}
            onScenarioSelect={handleScenarioSelect}
            onProtocolChange={setProtocolMode}
            onAiModeSelect={onAiModeRouteChange}
          />
        }
        main={
          <MainStage
            banner={<RefreshBanner wasRehydrated={wasHydrated} />}
            devtools={
              <DevtoolsTabs
                resolutions={resolutions}
                diffs={diffs}
                detachedValues={detachedValues}
                issues={issues}
                snapshot={snapshot}
                entries={[]}
              />
            }
            controls={
              <ScenarioContextCard
                stepIndex={Math.max(stepIndex, 0)}
                totalSteps={activeSteps.length}
                activeStepLabel={currentStep?.label ?? 'Step 1'}
                description={currentStep?.description ?? ''}
                narrativePrompt={currentStep?.narrativePrompt ?? ''}
                checkpoints={checkpoints}
                onPrev={() => pushStep(stepIndex - 1)}
                onNext={() => pushStep(stepIndex + 1)}
                onRewind={handleRewind}
                onCreateCheckpoint={handleCreateCheckpoint}
                onHallucinate={handleHallucinate}
              />
            }
            valueCallout={
              <ValueCallout hint={currentStep?.outcomeHint} resolutions={resolutions} diffs={diffs} />
            }
            renderedUi={
              snapshot?.view ? (
                <ContinuumRenderer view={snapshot.view} />
              ) : (
                <div>No view loaded</div>
              )
            }
          />
        }
      />
    </>
  );
}

const AI_KEY_STORAGE = 'continuum.playground.ai-keys';

function loadApiKeys(): Record<ProviderId, string> {
  try {
    const raw = window.localStorage.getItem(AI_KEY_STORAGE);
    if (!raw) {
      return { openai: '', google: '', anthropic: '' };
    }
    const parsed = JSON.parse(raw) as Record<ProviderId, string>;
    return {
      openai: parsed.openai ?? '',
      google: parsed.google ?? '',
      anthropic: parsed.anthropic ?? '',
    };
  } catch {
    return { openai: '', google: '', anthropic: '' };
  }
}

interface AIPlaygroundContentProps {
  onBackToIntro: () => void;
  onScenarioRouteChange: (scenarioId: string) => void;
}

function AIPlaygroundContent({ onBackToIntro, onScenarioRouteChange }: AIPlaygroundContentProps) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const { hasSuggestions, acceptAll, rejectAll } = useContinuumSuggestions();
  const { issues, diffs, resolutions } = useContinuumDiagnostics();
  const [protocolMode, setProtocolMode] = useState<ProtocolMode>('native');
  const [entries, setEntries] = useState<AIConversationEntry[]>([]);
  const [prompt, setPrompt] = useState('Create a travel planning form with destination, dates, budget, and submit.');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(aiProviders[0]?.id ?? 'openai');
  const [selectedModel, setSelectedModel] = useState(aiProviders[0]?.models[0] ?? '');
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>(() => loadApiKeys());
  const [isLoading, setIsLoading] = useState(false);
  const [autoFeedback, setAutoFeedback] = useState(true);
  const [attachments, setAttachments] = useState<AIAttachment[]>([]);

  const checkpoints = session.getCheckpoints();

  const handleRewind = useCallback(
    (checkpointId: string) => {
      session.rewind(checkpointId);
    },
    [session]
  );
  const handleCreateCheckpoint = useCallback(() => {
    if (!session.getSnapshot()) {
      return;
    }
    session.checkpoint();
  }, [session]);
  
  const handleClearSession = useCallback(() => {
    session.reset();
    setEntries([]);
    setPrompt('Create a travel planning form with destination, dates, budget, and submit.');
    setAttachments([]);
  }, [session]);

  useEffect(() => {
    const provider = aiProviders.find((entry) => entry.id === selectedProvider);
    if (!provider) {
      return;
    }
    if (!provider.models.includes(selectedModel)) {
      setSelectedModel(provider.models[0] ?? '');
    }
  }, [selectedProvider, selectedModel]);

  const persistApiKeys = useCallback((next: Record<ProviderId, string>) => {
    setApiKeys(next);
    window.localStorage.setItem(AI_KEY_STORAGE, JSON.stringify(next));
  }, []);

  const upsertEntry = useCallback((entry: AIConversationEntry) => {
    setEntries((previous) => [entry, ...previous].slice(0, 30));
  }, []);

  const submitMessages = useCallback(
    async (requestPrompt: string, correction = false) => {
      const key = apiKeys[selectedProvider] ?? '';
      const currentView = session.getSnapshot()?.view;
      const messages = correction
        ? buildCorrectionMessages({
            prompt: requestPrompt,
            currentView: currentView as ViewDefinition,
            validationErrors: [],
            issues: session.getIssues(),
            resolutions: session.getResolutions(),
            attachments,
          })
        : currentView
            ? buildEvolutionMessages(requestPrompt, currentView, attachments)
            : buildInitialMessages(requestPrompt, attachments);

      let response = await generateView({
        provider: selectedProvider,
        model: selectedModel,
        apiKey: key,
        systemPrompt: getSystemPrompt(),
        messages,
        currentView,
        attachments,
      });

      setAttachments([]); // Clear after submission

      if (currentView && !allowsCollectionRestructure(requestPrompt)) {
        const droppedCollectionKeys = detectDroppedCollectionKeys(
          currentView,
          response.view
        );
        if (droppedCollectionKeys.length > 0) {
          response = await generateView({
            provider: selectedProvider,
            model: selectedModel,
            apiKey: key,
            systemPrompt: getSystemPrompt(),
            messages: [
              ...messages,
              {
                role: 'user',
                content: [
                  'Correction: preserve existing collection keys unless explicitly asked to remove or split them.',
                  `Do not remove or rename these collection keys: ${droppedCollectionKeys.join(', ')}.`,
                  'Evolve those collections in place by updating their template fields.',
                  `Original instruction: ${requestPrompt.trim()}`,
                ].join('\n'),
                attachments,
              },
            ],
            currentView,
            attachments,
          });
        }
      }

      // Detect flat-array output and auto-correct
      if (currentView && isLikelyFlatArray(response.view)) {
        console.warn('[AI] Detected flat-array output — retrying with explicit nesting instruction');
        response = await generateView({
          provider: selectedProvider,
          model: selectedModel,
          apiKey: key,
          systemPrompt: getSystemPrompt(),
          messages: [
            ...messages,
            {
              role: 'user',
              content: [
                'CRITICAL CORRECTION: Your previous output returned a flat list of nodes. You MUST return a properly nested tree.',
                'Each group, row, and grid node MUST have a "children" array containing its child nodes.',
                'Each collection node MUST have a "template" object.',
                'Do NOT return nodes as a flat array at the top level — they must be nested inside their parent containers.',
                `Original instruction: ${requestPrompt.trim()}`,
              ].join('\n'),
              attachments,
            },
          ],
          currentView,
          attachments,
        });
      }

      const validationErrors = validateView(response.view);
      const entry: AIConversationEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        provider: selectedProvider,
        model: selectedModel,
        prompt: requestPrompt,
        createdAt: Date.now(),
        rawResponse: response.rawResponse,
        validationErrors,
        attachments: [...attachments],
      };

      if (validationErrors.length === 0) {
        session.pushView(response.view);
        applyViewDefaults(session, response.view);
        applyCollectionOptionSeeds(
          session,
          response.view,
          shouldSeedCollectionDefaultsFromPrompt(requestPrompt)
        );
        entry.viewVersion = response.view.version;
        entry.resolutions = session.getResolutions();
        entry.issues = session.getIssues();
      }

      upsertEntry(entry);
      return entry;
    },
    [apiKeys, selectedProvider, selectedModel, session, upsertEntry, attachments]
  );

  const handleSubmit = useCallback(async () => {
    if (isLoading) {
      return;
    }
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }
    const key = apiKeys[selectedProvider] ?? '';
    if (!key.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const first = await submitMessages(trimmedPrompt);
      const shouldCorrect =
        autoFeedback &&
        (Boolean(first.validationErrors?.length) ||
          Boolean(first.issues?.some((issue) => issue.severity === 'error')) ||
          Boolean(first.resolutions?.some((resolution) => resolution.resolution === 'detached')));
      if (shouldCorrect && session.getSnapshot()?.view) {
        await submitMessages(`Fix issues from previous output. ${trimmedPrompt}`, true);
      }
    } catch (error) {
      upsertEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        provider: selectedProvider,
        model: selectedModel,
        prompt: prompt.trim(),
        createdAt: Date.now(),
        requestError: error instanceof Error ? error.message : 'Unknown AI request error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [apiKeys, autoFeedback, isLoading, prompt, selectedProvider, session, submitMessages, upsertEntry, selectedModel]);

  const buildDebugLog = useCallback(() => {
    const currentSnapshot = session.getSnapshot();
    const log = {
      exportedAt: new Date().toISOString(),
      entries: [...entries].reverse().map((entry) => ({
        timestamp: new Date(entry.createdAt).toISOString(),
        provider: entry.provider,
        model: entry.model,
        prompt: entry.prompt,
        viewVersion: entry.viewVersion ?? null,
        validationErrors: entry.validationErrors ?? [],
        requestError: entry.requestError ?? null,
        resolutions: entry.resolutions ?? [],
        issues: entry.issues ?? [],
        rawResponse: entry.rawResponse ?? null,
        attachments: entry.attachments?.map(a => a.name) ?? [],
      })),
      currentSnapshot: currentSnapshot ? {
        view: currentSnapshot.view,
        data: currentSnapshot.data,
      } : null,
      diagnostics: {
        issues,
        diffs,
        resolutions,
      },
    };
    return JSON.stringify(log, null, 2);
  }, [entries, session, issues, diffs, resolutions]);

  return (
    <>
      <TraceAnimations resolutions={resolutions} />
      <ReconciliationToast resolutions={resolutions} />
      <AppShell
        header={
          <StoryHeader
            onBackToIntro={onBackToIntro}
            scenarios={scenarios}
            isAiMode={true}
            activeScenarioId=""
            activeScenarioTitle="Live AI Mode"
            activeScenarioSubtitle="Generate views with real providers and inspect reconciliation in real time"
            protocolMode={protocolMode}
            checkpointCount={checkpoints.length}
            onScenarioSelect={onScenarioRouteChange}
            onProtocolChange={setProtocolMode}
          />
        }
        main={
          <MainStage
            banner={<RefreshBanner wasRehydrated={false} />}
            controls={
              <AIControlCard
                providers={aiProviders.map((provider) => ({
                  id: provider.id,
                  name: provider.name,
                  models: provider.models,
                }))}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                apiKey={apiKeys[selectedProvider] ?? ''}
                prompt={prompt}
                autoFeedback={autoFeedback}
                entries={entries}
                isLoading={isLoading}
                onProviderChange={setSelectedProvider}
                onModelChange={setSelectedModel}
                onApiKeyChange={(nextKey) => {
                  persistApiKeys({
                    ...apiKeys,
                    [selectedProvider]: nextKey,
                  });
                }}
                onPromptChange={setPrompt}
                onAutoFeedbackChange={setAutoFeedback}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                onSubmit={handleSubmit}
                onClearSession={handleClearSession}
                onExportDebugLog={buildDebugLog}
                checkpoints={checkpoints}
                onRewind={handleRewind}
                onCreateCheckpoint={handleCreateCheckpoint}
                hasSuggestions={hasSuggestions}
                onAcceptAll={acceptAll}
                onRejectAll={rejectAll}
              />
            }
            valueCallout={<ValueCallout resolutions={resolutions} diffs={diffs} />}
            renderedUi={
              snapshot?.view ? (
                <ContinuumRenderer view={snapshot.view} />
              ) : (
                <div>Use the prompt panel to generate a first view.</div>
              )
            }
            devtools={
              <DevtoolsTabs
                resolutions={resolutions}
                diffs={diffs}
                detachedValues={snapshot?.data.detachedValues ?? {}}
                issues={issues}
                snapshot={snapshot}
                entries={entries}
              />
            }
          />
        }
      />
    </>
  );
}

function LandingRoute() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  const handleEnterPlayground = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => {
      navigate('/playground');
    }, 600);
  }, [navigate]);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(-40px)' : 'translateY(0)',
      }}
    >
      <LandingPage onEnter={handleEnterPlayground} />
    </div>
  );
}

function PlaygroundRoute() {
  const navigate = useNavigate();
  const { scenarioId } = useParams<{ scenarioId: string }>();

  if (!defaultScenarioId) {
    return null;
  }

  if (!scenarioId) {
    return <Navigate to={`/playground/${defaultScenarioId}`} replace />;
  }

  const validScenario = scenarios.some((scenario) => scenario.id === scenarioId);
  if (!validScenario) {
    return <Navigate to={`/playground/${defaultScenarioId}`} replace />;
  }

  return (
    <ContinuumProvider
      components={componentMap}
      persist="localStorage"
      sessionOptions={sessionOptions}
    >
      <PlaygroundContent
        onBackToIntro={() => navigate('/')}
        routeScenarioId={scenarioId}
        onScenarioRouteChange={(nextScenarioId) => navigate(`/playground/${nextScenarioId}`)}
        onAiModeRouteChange={() => navigate('/playground/ai')}
      />
    </ContinuumProvider>
  );
}

function PlaygroundAIRoute() {
  const navigate = useNavigate();

  return (
    <ContinuumProvider
      components={liveAiComponentMap}
      persist="localStorage"
      sessionOptions={sessionOptions}
    >
      <AIPlaygroundContent
        onBackToIntro={() => navigate('/')}
        onScenarioRouteChange={(nextScenarioId) => navigate(`/playground/${nextScenarioId}`)}
      />
    </ContinuumProvider>
  );
}

export default function App() {
  return (
    <>
      <style>{globalStyles}</style>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route
          path="/playground"
          element={
            defaultScenarioId ? (
              <Navigate to={`/playground/${defaultScenarioId}`} replace />
            ) : (
              <LandingRoute />
            )
          }
        />
        <Route path="/playground/ai" element={<PlaygroundAIRoute />} />
        <Route path="/playground/:scenarioId" element={<PlaygroundRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
