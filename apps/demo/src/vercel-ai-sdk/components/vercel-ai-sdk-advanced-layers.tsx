import { color, radius, space, type } from '../../ui/tokens';

const layerCards = [
  {
    title: 'Keep your own chat UI',
    description:
      'When the preset UI stops fitting, drop to the raw Continuum hook and keep the same transport contract underneath.',
    callout: 'Hook: useContinuumVercelAiSdkChat',
  },
  {
    title: 'Own the server route',
    description:
      'Keep auth, tools, persistence, and provider logic in your own AI SDK route while Continuum writes view data into the same stream.',
    callout: 'Writer: writeContinuumExecutionToUiMessageWriter',
  },
  {
    title: 'Use draft previews',
    description:
      'Send larger structural edits into a draft lane first so users can keep typing without blowing away committed session state.',
    callout: "Stream mode: 'draft'",
  },
] as const;

const panelStyle = {
  display: 'grid',
  gap: space.lg,
  padding: space.lg,
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
} as const;

const introStyle = {
  ...type.small,
  color: color.textMuted,
  maxWidth: 720,
} as const;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: space.md,
} as const;

const cardStyle = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
} as const;

const calloutStyle = {
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.borderSoft}`,
  background: color.surface,
  width: 'fit-content',
} as const;

export function VercelAiSdkAdvancedLayers() {
  return (
    <div style={panelStyle}>
      <div style={introStyle}>
        Start with the wrapper. These are the first three escape hatches teams
        usually reach for when they want more control.
      </div>

      <div style={gridStyle}>
        {layerCards.map((card) => (
          <article key={card.title} style={cardStyle}>
            <div style={{ ...type.title, color: color.text }}>{card.title}</div>
            <div style={{ ...type.body, color: color.text }}>
              {card.description}
            </div>
            <div style={calloutStyle}>{card.callout}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
