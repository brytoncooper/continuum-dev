import type { ContinuumIntegrationPersistedField } from '@continuum-dev/ai-engine';
import type { CSSProperties, ReactNode } from 'react';
import { PageShell } from '../ui/layout';
import { SiteNav } from '../ui/site-nav';
import { color, radius, space, type } from '../ui/tokens';
import { financialPlanningIntegrationCatalog } from '../vercel-ai-sdk/data/financial-planning-catalog';

const pageIntroStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
  marginBottom: space.xxl,
  lineHeight: 1.55,
};

const endpointListStyle: CSSProperties = {
  display: 'grid',
  gap: space.xxl,
};

const cardStyle: CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  background: color.surface,
  padding: space.xxl,
  boxShadow:
    '0 6px 16px rgba(22, 32, 51, 0.05), 0 1px 3px rgba(22, 32, 51, 0.03)',
};

const titleRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: space.md,
  marginBottom: space.sm,
};

const endpointTitleStyle: CSSProperties = {
  ...type.title,
  color: color.text,
  margin: 0,
};

const routeBadgeStyle: CSSProperties = {
  ...type.small,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  color: color.textMuted,
  padding: `${space.xs}px ${space.sm}px`,
  borderRadius: radius.sm,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
};

const endpointIdStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
  marginBottom: space.md,
};

const descriptionStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
  marginBottom: space.lg,
  lineHeight: 1.5,
};

const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  lineHeight: 1.4,
};

const thStyle: CSSProperties = {
  ...type.label,
  textAlign: 'left',
  padding: `${space.md}px ${space.lg}px`,
  borderBottom: `1px solid ${color.border}`,
  background: color.surfaceInset,
  color: color.textSoft,
};

const tdStyle: CSSProperties = {
  padding: `${space.md}px ${space.lg}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  color: color.text,
  verticalAlign: 'top',
};

const tdMutedStyle: CSSProperties = {
  ...tdStyle,
  color: color.textMuted,
};

const monoStyle: CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 12,
};

const requiredBadgeStyle: CSSProperties = {
  ...type.small,
  fontWeight: 600,
  color: color.text,
};

const optionalBadgeStyle: CSSProperties = {
  ...type.small,
  fontWeight: 600,
  color: color.textSoft,
};

function buildPersistedFieldTypeLabel(
  field: ContinuumIntegrationPersistedField
): string {
  const shape = field.shape ?? 'scalar';
  if (shape === 'collection') {
    const min = field.minItems != null ? ` min=${field.minItems}` : '';
    const max = field.maxItems != null ? ` max=${field.maxItems}` : '';
    return `collection${min}${max}`;
  }
  if (shape === 'object') {
    return 'object';
  }
  const base = field.dataType ?? 'string';
  if (field.enumValues && field.enumValues.length > 0) {
    return `${base} (${field.enumValues.join(', ')})`;
  }
  return base;
}

function renderPersistedFieldTableRows(
  fields: ContinuumIntegrationPersistedField[],
  depth: number
): ReactNode[] {
  const rows: ReactNode[] = [];
  fields.forEach((field, index) => {
    const shape = field.shape ?? 'scalar';
    const pad = space.lg + depth * 12;
    const rowKey = `${depth}-${field.semanticKey}-${index}`;
    rows.push(
      <tr key={rowKey}>
        <td style={{ ...tdStyle, paddingLeft: pad }}>
          <span style={monoStyle}>{field.semanticKey}</span>
        </td>
        <td style={tdStyle}>{field.label}</td>
        <td style={tdMutedStyle}>
          <span style={monoStyle}>{buildPersistedFieldTypeLabel(field)}</span>
        </td>
        <td style={tdStyle}>
          {field.required ? (
            <span style={requiredBadgeStyle}>Yes</span>
          ) : (
            <span style={optionalBadgeStyle}>No</span>
          )}
        </td>
      </tr>
    );
    if (shape === 'object' && field.fields && field.fields.length > 0) {
      rows.push(...renderPersistedFieldTableRows(field.fields, depth + 1));
    }
    if (
      shape === 'collection' &&
      field.itemFields &&
      field.itemFields.length > 0
    ) {
      rows.push(
        <tr key={`${rowKey}-item-heading`}>
          <td
            colSpan={4}
            style={{ ...tdMutedStyle, paddingLeft: pad + 14, fontSize: 12 }}
          >
            Row template
          </td>
        </tr>
      );
      rows.push(...renderPersistedFieldTableRows(field.itemFields, depth + 1));
    }
  });
  return rows;
}

export function IntegrationSchemasPage() {
  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Demo integration catalog"
      title="Endpoint payload schemas"
      description="Reference for the fictional Harborline Financial Workspace demo: HTTP surface and persisted fields per endpoint (required vs optional semantic keys)."
    >
      <p style={pageIntroStyle}>
        {financialPlanningIntegrationCatalog.productSummary}
      </p>

      <div style={endpointListStyle}>
        {financialPlanningIntegrationCatalog.endpoints.map((endpoint) => (
          <article key={endpoint.id} style={cardStyle}>
            <div style={titleRowStyle}>
              <h2 style={endpointTitleStyle}>{endpoint.userAction}</h2>
              <span style={routeBadgeStyle}>
                {endpoint.method.toUpperCase()} {endpoint.path}
              </span>
            </div>
            <div style={endpointIdStyle}>Endpoint id: {endpoint.id}</div>
            <p style={descriptionStyle}>{endpoint.description}</p>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Semantic key</th>
                    <th style={thStyle}>Label</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {renderPersistedFieldTableRows(endpoint.persistedFields, 0)}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
