import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Checkpoint, SchemaSnapshot } from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationTrace, StateDiff } from '@continuum/runtime';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumDiagnostics,
  useContinuumHydrated,
} from '@continuum/react';
import { a2uiAdapter } from '@continuum/adapters';
import { componentMap } from './component-map';
import { steps } from './fake-agent';
import { a2uiSteps } from './a2ui-steps';
import { hallucinate } from './chaos';

type ProtocolMode = 'native' | 'a2ui';

const COLORS = {
  bg: '#0f1117',
  surface: '#161b22',
  surfaceAlt: '#1c2128',
  border: '#30363d',
  borderActive: '#58a6ff',
  text: '#e6edf3',
  textMuted: '#8b949e',
  accent: '#58a6ff',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  greenBg: '#0d1117',
  yellowBg: '#1c1a0e',
  redBg: '#1c0e0e',
  white: '#ffffff',
};

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 10,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function RewindTimeline({
  checkpoints,
  onRewind,
}: {
  checkpoints: Checkpoint[];
  onRewind: (id: string) => void;
}) {
  if (checkpoints.length === 0) return null;

  return (
    <div
      data-testid="rewind-timeline"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '12px 16px',
        background: COLORS.surfaceAlt,
        borderRadius: 8,
        overflow: 'auto',
      }}
    >
      <span style={{ fontSize: 12, color: COLORS.textMuted, marginRight: 8, whiteSpace: 'nowrap' }}>
        Rewind:
      </span>
      {checkpoints.map((cp, i) => (
        <button
          key={cp.id}
          data-testid={`rewind-${i}`}
          onClick={() => onRewind(cp.id)}
          title={`Rewind to checkpoint ${i + 1} (v${cp.snapshot.schema.version})`}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: `2px solid ${COLORS.border}`,
            background: COLORS.surface,
            color: COLORS.text,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = COLORS.accent;
            e.currentTarget.style.background = COLORS.accent;
            e.currentTarget.style.color = COLORS.white;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COLORS.border;
            e.currentTarget.style.background = COLORS.surface;
            e.currentTarget.style.color = COLORS.text;
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

function RefreshBanner({ wasRehydrated }: { wasRehydrated: boolean }) {
  const [visible, setVisible] = useState(wasRehydrated);

  useEffect(() => {
    if (!wasRehydrated) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [wasRehydrated]);

  if (!visible) return null;

  return (
    <div
      data-testid="refresh-banner"
      style={{
        padding: '10px 16px',
        background: '#0d2847',
        borderRadius: 8,
        border: `1px solid ${COLORS.accent}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        color: COLORS.accent,
      }}
    >
      <span style={{ fontSize: 16 }}>&#8635;</span>
      <span style={{ flex: 1 }}>Session restored from local storage. Your state survived the refresh.</span>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          color: COLORS.accent,
          cursor: 'pointer',
          fontSize: 16,
          padding: '0 4px',
          lineHeight: 1,
        }}
      >
        &times;
      </button>
    </div>
  );
}

function IssuesSummary({ issues }: { issues: ReconciliationIssue[] }) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  if (issues.length === 0) return <span style={{ color: COLORS.textMuted, fontSize: 12 }}>No issues</span>;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {errors.length > 0 && <Badge label={`${errors.length} error${errors.length > 1 ? 's' : ''}`} color={COLORS.red} bg={COLORS.redBg} />}
      {warnings.length > 0 && <Badge label={`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`} color={COLORS.yellow} bg={COLORS.yellowBg} />}
      {infos.length > 0 && <Badge label={`${infos.length} info`} color={COLORS.accent} bg="transparent" />}
    </div>
  );
}

function TraceList({ trace }: { trace: ReconciliationTrace[] }) {
  if (trace.length === 0) return <div style={{ color: COLORS.textMuted, fontSize: 12, padding: 8 }}>No trace available</div>;

  const actionColors: Record<string, string> = {
    carried: COLORS.green,
    migrated: COLORS.yellow,
    dropped: COLORS.red,
    added: COLORS.accent,
  };

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {trace.map((entry, i) => (
        <div
          key={i}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 600, color: COLORS.text, minWidth: 100 }}>
            {entry.componentId}
          </span>
          <Badge
            label={entry.action}
            color={COLORS.white}
            bg={actionColors[entry.action] ?? COLORS.textMuted}
          />
          {entry.matchedBy && (
            <span style={{ color: COLORS.textMuted }}>
              via {entry.matchedBy}
            </span>
          )}
          {entry.priorType && entry.priorType !== entry.newType && (
            <span style={{ color: COLORS.yellow }}>
              {entry.priorType} → {entry.newType}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DiffList({ diffs }: { diffs: StateDiff[] }) {
  if (diffs.length === 0) return <div style={{ color: COLORS.textMuted, fontSize: 12, padding: 8 }}>No diffs</div>;

  const typeColors: Record<string, string> = {
    added: COLORS.green,
    removed: COLORS.red,
    modified: COLORS.accent,
    migrated: COLORS.yellow,
    'type-changed': COLORS.red,
  };

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {diffs.map((d, i) => (
        <div
          key={i}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 600, color: COLORS.text, minWidth: 100 }}>
            {d.componentId}
          </span>
          <Badge
            label={d.type}
            color={COLORS.white}
            bg={typeColors[d.type] ?? COLORS.textMuted}
          />
          {d.reason && (
            <span style={{ color: COLORS.textMuted, fontSize: 11 }}>
              {d.reason}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function CollapsiblePanel({
  title,
  count,
  testId,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  testId: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details data-testid={testId} open={defaultOpen} style={{ marginBottom: 8 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          color: COLORS.text,
          padding: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {title}
        {count !== undefined && (
          <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>({count})</span>
        )}
      </summary>
      <div style={{ paddingBottom: 8 }}>{children}</div>
    </details>
  );
}

function buildTraceStyles(trace: ReconciliationTrace[]): string {
  const KEYFRAMES = `
@keyframes continuum-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-4px); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-1px); }
  90% { transform: translateX(1px); }
}
@keyframes continuum-pulse {
  0% { box-shadow: 0 0 0 0 rgba(210, 153, 34, 0.5); }
  50% { box-shadow: 0 0 0 4px rgba(210, 153, 34, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(210, 153, 34, 0); }
}
@keyframes continuum-fadein {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;

  const rules = trace
    .filter((t) => t.action !== 'carried')
    .map((t) => {
      const sel = `[data-continuum-id="${t.componentId}"]`;
      switch (t.action) {
        case 'dropped':
          return `${sel} { animation: continuum-shake 0.5s ease; border-radius: 6px; outline: 2px solid ${COLORS.red}; outline-offset: 2px; }`;
        case 'migrated':
          return `${sel} { animation: continuum-pulse 0.6s ease; border-radius: 6px; outline: 2px solid ${COLORS.yellow}; outline-offset: 2px; }`;
        case 'added':
          return `${sel} { animation: continuum-fadein 0.4s ease; border-radius: 6px; outline: 2px solid ${COLORS.green}; outline-offset: 2px; }`;
        default:
          return '';
      }
    })
    .filter(Boolean);

  if (rules.length === 0) return '';
  return KEYFRAMES + rules.join('\n');
}

function TraceAnimations({ trace }: { trace: ReconciliationTrace[] }) {
  const [animKey, setAnimKey] = useState(0);
  const prevTraceRef = useRef<ReconciliationTrace[]>([]);

  useEffect(() => {
    const changed =
      trace.length !== prevTraceRef.current.length ||
      trace.some(
        (t, i) =>
          t.componentId !== prevTraceRef.current[i]?.componentId ||
          t.action !== prevTraceRef.current[i]?.action
      );

    if (changed) {
      prevTraceRef.current = trace;
      setAnimKey((k) => k + 1);
    }
  }, [trace]);

  const css = useMemo(() => buildTraceStyles(trace), [trace]);

  if (!css) return null;

  return <style key={animKey} dangerouslySetInnerHTML={{ __html: css }} />;
}

function ReconciliationToast({ trace }: { trace: ReconciliationTrace[] }) {
  const [visible, setVisible] = useState(false);
  const [summary, setSummary] = useState('');
  const prevTraceRef = useRef<ReconciliationTrace[]>([]);

  useEffect(() => {
    const hasNonCarried = trace.some((t) => t.action !== 'carried');
    const changed =
      trace.length > 0 &&
      hasNonCarried &&
      (trace.length !== prevTraceRef.current.length ||
        trace.some(
          (t, i) =>
            t.componentId !== prevTraceRef.current[i]?.componentId ||
            t.action !== prevTraceRef.current[i]?.action
        ));

    prevTraceRef.current = trace;

    if (!changed) return;

    const counts: Record<string, number> = {};
    for (const t of trace) {
      counts[t.action] = (counts[t.action] ?? 0) + 1;
    }

    const parts: string[] = [];
    if (counts['carried']) parts.push(`${counts['carried']} carried`);
    if (counts['added']) parts.push(`${counts['added']} added`);
    if (counts['migrated']) parts.push(`${counts['migrated']} migrated`);
    if (counts['dropped']) parts.push(`${counts['dropped']} dropped`);

    setSummary(parts.join(', '));
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [trace]);

  if (!visible || !summary) return null;

  return (
    <div
      data-testid="reconciliation-toast"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 20px',
        borderRadius: 8,
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.text,
        fontSize: 13,
        fontWeight: 500,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
        Reconciled:
      </span>
      {summary}
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          color: COLORS.textMuted,
          cursor: 'pointer',
          fontSize: 14,
          padding: '0 2px',
          lineHeight: 1,
          marginLeft: 4,
        }}
      >
        &times;
      </button>
    </div>
  );
}

function ProtocolToggle({
  mode,
  onChange,
}: {
  mode: ProtocolMode;
  onChange: (mode: ProtocolMode) => void;
}) {
  const modes: { value: ProtocolMode; label: string }[] = [
    { value: 'native', label: 'Native' },
    { value: 'a2ui', label: 'A2UI' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        overflow: 'hidden',
      }}
    >
      {modes.map((m) => (
        <button
          key={m.value}
          data-testid={`protocol-${m.value}`}
          onClick={() => onChange(m.value)}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: mode === m.value ? COLORS.accent : COLORS.surface,
            color: mode === m.value ? COLORS.white : COLORS.textMuted,
            transition: 'all 0.15s',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function PlaygroundContent() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const { issues, diffs, trace, checkpoints } = useContinuumDiagnostics();
  const wasHydrated = useContinuumHydrated();

  const [stepIndex, setStepIndex] = useState(-1);
  const [protocolMode, setProtocolMode] = useState<ProtocolMode>('native');
  const initializedRef = useRef(false);

  const activeSteps = useMemo(() => {
    if (protocolMode === 'native') {
      return steps.map((s) => ({ label: s.label, description: s.description, schema: s.schema }));
    }
    return a2uiSteps.map((s) => ({
      label: s.label,
      description: s.description,
      schema: a2uiAdapter.toSchema(s.form),
    }));
  }, [protocolMode]);

  const getSchemaForStep = useCallback(
    (idx: number): SchemaSnapshot => activeSteps[idx].schema,
    [activeSteps]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const existing = session.getSnapshot();
    if (existing) {
      const matchedIdx = activeSteps.findIndex((s) => s.schema.version === existing.schema.version);
      setStepIndex(matchedIdx >= 0 ? matchedIdx : activeSteps.length - 1);
    } else {
      session.pushSchema(getSchemaForStep(0));
      setStepIndex(0);
    }
  }, [session, activeSteps, getSchemaForStep]);

  const handleStep = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(activeSteps.length - 1, idx));
      setStepIndex(clamped);
      session.pushSchema(getSchemaForStep(clamped));
    },
    [session, activeSteps.length, getSchemaForStep]
  );

  const handleProtocolChange = useCallback(
    (mode: ProtocolMode) => {
      setProtocolMode(mode);
      const newSteps =
        mode === 'native'
          ? steps.map((s) => s.schema)
          : a2uiSteps.map((s) => a2uiAdapter.toSchema(s.form));
      session.pushSchema(newSteps[0]);
      setStepIndex(0);
    },
    [session]
  );

  const handleHallucinate = useCallback(() => {
    const schema = session.getSnapshot()?.schema;
    if (!schema) return;
    session.pushSchema(hallucinate(schema));
  }, [session]);

  const handleRewind = useCallback(
    (checkpointId: string) => {
      session.rewind(checkpointId);
      const snap = session.getSnapshot();
      if (snap) {
        const matchedIdx = activeSteps.findIndex((s) => s.schema.version === snap.schema.version);
        setStepIndex(matchedIdx >= 0 ? matchedIdx : -1);
      }
    },
    [session, activeSteps]
  );

  if (stepIndex === -1 && !wasHydrated) {
    return <div style={{ color: COLORS.textMuted, padding: 24 }}>Loading...</div>;
  }

  const currentStep = stepIndex >= 0 && stepIndex < activeSteps.length ? activeSteps[stepIndex] : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gridTemplateRows: 'auto 1fr',
        gap: 16,
        height: '100vh',
        padding: 16,
        boxSizing: 'border-box',
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Continuum
          </h1>
          <span style={{ color: COLORS.textMuted, fontSize: 12 }}>Playground</span>
          <ProtocolToggle mode={protocolMode} onChange={handleProtocolChange} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentStep && (
            <span data-testid="step-label" style={{ fontSize: 13, color: COLORS.textMuted }}>
              {currentStep.label}
            </span>
          )}
        </div>
      </div>

      {/* Left Panel - Generated UI */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'auto',
        }}
      >
        <RefreshBanner wasRehydrated={wasHydrated} />

        {/* Agent Step Controls */}
        <div
          style={{
            padding: 16,
            background: COLORS.surface,
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AI Agent Simulation
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              data-testid="btn-prev"
              disabled={stepIndex <= 0}
              onClick={() => handleStep(stepIndex - 1)}
              style={btnStyle(stepIndex <= 0)}
            >
              ← Prev
            </button>
            <button
              data-testid="btn-next"
              disabled={stepIndex >= activeSteps.length - 1}
              onClick={() => handleStep(stepIndex + 1)}
              style={btnStyle(stepIndex >= activeSteps.length - 1)}
            >
              Next →
            </button>
            <button
              data-testid="btn-hallucinate"
              onClick={handleHallucinate}
              style={{
                ...btnStyle(false),
                background: COLORS.red,
                borderColor: COLORS.red,
                color: COLORS.white,
                marginLeft: 'auto',
              }}
            >
              Hallucinate
            </button>
          </div>
          {currentStep && (
            <div style={{ marginTop: 8, fontSize: 12, color: COLORS.textMuted }}>
              {currentStep.description}
            </div>
          )}
        </div>

        <RewindTimeline checkpoints={checkpoints} onRewind={handleRewind} />

        {/* Rendered UI */}
        <div
          data-testid="generated-ui"
          style={{
            padding: 20,
            background: COLORS.surface,
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            flex: 1,
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Generated UI
          </div>
          {snapshot?.schema ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <ContinuumRenderer schema={snapshot.schema} />
            </div>
          ) : (
            <div style={{ color: COLORS.textMuted }}>No schema loaded</div>
          )}
        </div>
      </div>

      <TraceAnimations trace={trace} />
      <ReconciliationToast trace={trace} />

      {/* Right Panel - Dev Tools */}
      <div
        data-testid="devtools"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'auto',
          padding: '0 0 0 8px',
          borderLeft: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>
          Dev Tools
        </div>

        <IssuesSummary issues={issues} />

        <CollapsiblePanel
          title="Reconciliation Trace"
          count={trace.length}
          testId="panel-trace"
          defaultOpen={trace.some((t) => t.action === 'dropped' || t.action === 'migrated')}
        >
          <TraceList trace={trace} />
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Diffs"
          count={diffs.length}
          testId="panel-diffs"
          defaultOpen={diffs.length > 0}
        >
          <DiffList diffs={diffs} />
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Issues"
          count={issues.length}
          testId="panel-issues"
          defaultOpen={issues.some((i) => i.severity === 'error' || i.severity === 'warning')}
        >
          {issues.length === 0 ? (
            <div style={{ color: COLORS.textMuted, fontSize: 12 }}>Clean</div>
          ) : (
            <div style={{ display: 'grid', gap: 4 }}>
              {issues.map((issue, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    background:
                      issue.severity === 'error'
                        ? COLORS.redBg
                        : issue.severity === 'warning'
                          ? COLORS.yellowBg
                          : COLORS.surfaceAlt,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{issue.code}</span>
                  {issue.componentId && (
                    <span style={{ color: COLORS.textMuted }}> · {issue.componentId}</span>
                  )}
                  <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                    {issue.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel title="Snapshot" testId="panel-snapshot">
          <pre
            style={{
              fontSize: 11,
              overflow: 'auto',
              background: COLORS.surfaceAlt,
              padding: 10,
              borderRadius: 6,
              color: COLORS.textMuted,
              margin: 0,
              maxHeight: 300,
            }}
          >
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </CollapsiblePanel>
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    background: disabled ? COLORS.surfaceAlt : COLORS.surface,
    color: disabled ? COLORS.textMuted : COLORS.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    fontWeight: 600,
    opacity: disabled ? 0.5 : 1,
  };
}

export default function App() {
  return (
    <ContinuumProvider components={componentMap} persist="localStorage">
      <PlaygroundContent />
    </ContinuumProvider>
  );
}
