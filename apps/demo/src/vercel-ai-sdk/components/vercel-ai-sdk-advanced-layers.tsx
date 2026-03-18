import { useState } from 'react';
import { color, radius, space, type } from '../../ui/tokens';

type LayerId = 'raw-hook' | 'worker' | 'drafts';

const layerTabs: Array<{ id: LayerId; label: string }> = [
  { id: 'raw-hook', label: 'Raw hook' },
  { id: 'worker', label: 'Worker boundary' },
  { id: 'drafts', label: 'Draft previews' },
];

const layerCopy: Record<
  LayerId,
  {
    title: string;
    description: string;
    snippet: string;
  }
> = {
  'raw-hook': {
    title: 'Drop to the raw transport hook when you outgrow the wrapper',
    description:
      'The starter-kit wrapper is the fast lane, not the only lane. When teams need custom chat UI or request orchestration, they can keep Continuum and swap down to the adapter directly.',
    snippet: `import {
  useContinuumSession,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/ai-core';

const chat = useContinuumVercelAiSdkChat({
  session: useContinuumSession(),
  transport,
});`,
  },
  worker: {
    title: 'Compose into an app-owned AI SDK route',
    description:
      'The adapter does not need to own your route. You can keep auth, tools, persistence, and provider selection in your own handler, then write Continuum data parts into the same AI SDK UI stream.',
    snippet: `const stream = createUIMessageStream({
  execute: ({ writer }) => {
    writer.merge(result.toUIMessageStream());
    return writeContinuumExecutionToUiMessageWriter({
      writer,
      adapter,
      instruction,
      context: { currentView, currentData },
    });
  },
});`,
  },
  drafts: {
    title: 'Draft streams protect active typing',
    description:
      'Large structural edits land in a draft preview first. Users can keep typing into the preview without blowing away the committed session until the stream is ready to commit.',
    snippet: `createContinuumVercelAiSdkViewDataChunk(
  { view: nextView },
  { transient: true, streamMode: 'draft' }
);`,
  },
};

export function VercelAiSdkAdvancedLayers() {
  const [activeLayer, setActiveLayer] = useState<LayerId>('raw-hook');
  const active = layerCopy[activeLayer];

  return (
    <div
      style={{
        display: 'grid',
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        background: color.surface,
      }}
    >
      <div style={{ display: 'grid', gap: space.xs }}>
        <div style={{ ...type.section, color: color.text }}>
          Advanced layers
        </div>
        <div style={{ ...type.small, color: color.textMuted }}>
          Start with the wrapper. Peel it back only when you need more control.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.sm }}>
        {layerTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveLayer(tab.id);
            }}
            aria-pressed={activeLayer === tab.id}
            style={{
              boxSizing: 'border-box',
              padding: `${space.sm}px ${space.md}px`,
              borderRadius: radius.pill,
              border: `1px solid ${color.border}`,
              background:
                activeLayer === tab.id ? color.accent : color.surfaceMuted,
              color: activeLayer === tab.id ? color.surface : color.text,
              cursor: 'pointer',
              ...type.small,
              fontWeight: 600,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.md,
          border: `1px solid ${color.borderSoft}`,
          background: color.surfaceMuted,
        }}
      >
        <div style={{ ...type.title, color: color.text }}>{active.title}</div>
        <div style={{ ...type.body, color: color.text }}>{active.description}</div>
        <pre
          style={{
            margin: 0,
            overflowX: 'auto',
            padding: space.md,
            borderRadius: radius.md,
            border: `1px solid ${color.borderSoft}`,
            background: color.surface,
            color: color.text,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <code>{active.snippet}</code>
        </pre>
      </div>
    </div>
  );
}
