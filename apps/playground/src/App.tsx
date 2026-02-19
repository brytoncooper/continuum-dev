import { useEffect, useRef, useState } from 'react';
import type { ContinuitySnapshot } from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationTrace, StateDiff } from '@continuum/runtime';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
} from '@continuum/react';
import { componentMap } from './component-map';
import { steps } from './fake-agent';
import { hallucinate } from './chaos';

interface HistoryEntry {
  seq: number;
  action: string;
  stepLabel?: string;
  diffs?: string[];
  issues?: string[];
  trace?: Record<string, number>;
  stateKeys?: string[];
  components?: string[];
}

function buildPushEntry(
  seq: number,
  action: string,
  stepLabel: string,
  currentDiffs: StateDiff[],
  currentIssues: ReconciliationIssue[],
  currentTrace: ReconciliationTrace[],
  stateValues: Record<string, unknown>
): HistoryEntry {
  const traceSummary: Record<string, number> = {};
  for (const t of currentTrace) {
    traceSummary[t.action] = (traceSummary[t.action] ?? 0) + 1;
  }

  return {
    seq,
    action,
    stepLabel,
    diffs: currentDiffs.map((d) => `${d.componentId}: ${d.type}`),
    issues: currentIssues
      .filter((i) => i.severity !== 'info')
      .map((i) => `${i.code}${i.componentId ? `: ${i.componentId}` : ''}`),
    trace: traceSummary,
    stateKeys: Object.keys(stateValues).filter(
      (k) => stateValues[k] !== undefined
    ),
  };
}

function formatHistoryForClipboard(entries: HistoryEntry[]): string {
  const lines = entries.map((e) => JSON.stringify(e));
  return `[\n  ${lines.join(',\n  ')}\n]`;
}

function PlaygroundContent() {
  const session = useContinuumSession();

  const [stepIndex, setStepIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<ContinuitySnapshot | null>(null);
  const [issues, setIssues] = useState<ReconciliationIssue[]>([]);
  const [diffs, setDiffs] = useState<StateDiff[]>([]);
  const [trace, setTrace] = useState<ReconciliationTrace[]>([]);
  const [log, setLog] = useState(session.getEventLog());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const seqRef = useRef(0);
  const lastPushEventCountRef = useRef(0);

  function recordPush(action: string, stepLabel: string) {
    const eventLog = session.getEventLog();
    const newEntries: HistoryEntry[] = [];

    if (eventLog.length > lastPushEventCountRef.current) {
      const recentEvents = eventLog.slice(lastPushEventCountRef.current);
      const touchedComponents = [
        ...new Set(recentEvents.map((e) => e.componentId)),
      ];
      newEntries.push({
        seq: seqRef.current++,
        action: 'interaction',
        components: touchedComponents,
      });
    }

    const currentDiffs = session.getDiffs();
    const currentIssues = session.getIssues();
    const currentTrace = session.getTrace();
    const stateValues = session.getSnapshot()?.state.values ?? {};

    newEntries.push(
      buildPushEntry(
        seqRef.current++,
        action,
        stepLabel,
        currentDiffs,
        currentIssues,
        currentTrace,
        stateValues
      )
    );

    lastPushEventCountRef.current = eventLog.length;
    setHistory((prev) => [...prev, ...newEntries]);
  }

  useEffect(() => {
    session.pushSchema(steps[0].schema);
    setSnapshot(session.getSnapshot());
    setIssues(session.getIssues());
    setDiffs(session.getDiffs());
    setTrace(session.getTrace());

    const initDiffs = session.getDiffs();
    const initIssues = session.getIssues();
    const initTrace = session.getTrace();
    const initValues = session.getSnapshot()?.state.values ?? {};
    setHistory([
      buildPushEntry(
        seqRef.current++,
        'init',
        steps[0].label,
        initDiffs,
        initIssues,
        initTrace,
        initValues
      ),
    ]);
    lastPushEventCountRef.current = session.getEventLog().length;

    const unsubSnap = session.onSnapshot((s) => {
      setSnapshot(s);
      setDiffs(session.getDiffs());
      setTrace(session.getTrace());
      setLog(session.getEventLog());
    });
    const unsubIssues = session.onIssues((i) => setIssues(i));
    return () => {
      unsubSnap();
      unsubIssues();
    };
  }, [session]);

  const currentSchema = snapshot?.schema;

  function handlePrev() {
    const prev = stepIndex;
    const next = Math.max(0, stepIndex - 1);
    setStepIndex(next);
    session.pushSchema(steps[next].schema);
    recordPush(`step ${prev + 1}->${next + 1}`, steps[next].label);
  }

  function handleNext() {
    const prev = stepIndex;
    const next = Math.min(steps.length - 1, stepIndex + 1);
    setStepIndex(next);
    session.pushSchema(steps[next].schema);
    recordPush(`step ${prev + 1}->${next + 1}`, steps[next].label);
  }

  function handleHallucinate() {
    if (!currentSchema) return;
    session.pushSchema(hallucinate(currentSchema));
    recordPush('hallucination', steps[stepIndex].label);
  }

  function handleCopyHistory() {
    const text = formatHistoryForClipboard(history);
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    });
  }

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Continuum Playground</h1>

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <button
          data-testid="btn-prev"
          disabled={stepIndex === 0}
          onClick={handlePrev}
        >
          Prev
        </button>
        <button
          data-testid="btn-next"
          disabled={stepIndex === steps.length - 1}
          onClick={handleNext}
        >
          Next
        </button>
        <button
          data-testid="btn-hallucinate"
          disabled={!currentSchema}
          onClick={handleHallucinate}
          style={{
            marginLeft: 'auto',
            background: '#d1242f',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          Simulate Hallucination
        </button>
        <span data-testid="step-label" style={{ marginLeft: 8, fontWeight: 600 }}>
          {steps[stepIndex].label}
        </span>
      </div>

      {currentSchema ? (
        <ContinuumRenderer schema={currentSchema} />
      ) : (
        <div>No schema yet</div>
      )}

      <hr
        style={{
          margin: '24px 0',
          border: 'none',
          borderTop: '1px solid #ddd',
        }}
      />

      <details data-testid="panel-snapshot">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Snapshot JSON
        </summary>
        <pre
          style={{
            fontSize: 12,
            overflow: 'auto',
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
          }}
        >
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </details>

      <details data-testid="panel-diffs" open={diffs.length > 0}>
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            color: diffs.length > 0 ? '#0969da' : undefined,
          }}
        >
          Diffs ({diffs.length})
        </summary>
        <pre
          style={{
            fontSize: 12,
            overflow: 'auto',
            background: '#f0f6ff',
            padding: 12,
            borderRadius: 4,
          }}
        >
          {JSON.stringify(diffs, null, 2)}
        </pre>
      </details>

      <details
        data-testid="panel-issues"
        open={issues.some(
          (i) => i.severity === 'error' || i.severity === 'warning'
        )}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            color: issues.some((i) => i.severity === 'error')
              ? '#d1242f'
              : issues.some((i) => i.severity === 'warning')
                ? '#bf8700'
                : undefined,
          }}
        >
          Issues ({issues.length})
        </summary>
        <pre
          style={{
            fontSize: 12,
            overflow: 'auto',
            background: issues.some((i) => i.severity === 'error')
              ? '#fff0f0'
              : '#f5f5f5',
            padding: 12,
            borderRadius: 4,
          }}
        >
          {JSON.stringify(issues, null, 2)}
        </pre>
      </details>

      <details
        data-testid="panel-trace"
        open={trace.some((t) => t.action === 'dropped' || t.action === 'migrated')}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            color: trace.some((t) => t.action === 'dropped')
              ? '#d1242f'
              : trace.some((t) => t.action === 'migrated')
                ? '#bf8700'
                : undefined,
          }}
        >
          Reconciliation Trace ({trace.length})
        </summary>
        {trace.length > 0 ? (
          <div
            style={{
              fontSize: 12,
              overflow: 'auto',
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              display: 'grid',
              gap: 8,
            }}
          >
            {trace.map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  background:
                    entry.action === 'dropped'
                      ? '#fff0f0'
                      : entry.action === 'migrated'
                        ? '#fff8e1'
                        : entry.action === 'added'
                          ? '#f0fff0'
                          : '#fff',
                  border: '1px solid #e0e0e0',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {entry.componentId}
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background:
                        entry.action === 'dropped'
                          ? '#d1242f'
                          : entry.action === 'migrated'
                            ? '#bf8700'
                            : entry.action === 'added'
                              ? '#1a7f37'
                              : '#656d76',
                      color: '#fff',
                    }}
                  >
                    {entry.action}
                  </span>
                </div>
                <div style={{ color: '#656d76' }}>
                  {entry.matchedBy
                    ? `matched ${entry.priorId} by ${entry.matchedBy}`
                    : 'new component'}
                  {entry.priorType && entry.priorType !== entry.newType && (
                    <span>
                      {' '}
                      &middot; {entry.priorType} &rarr; {entry.newType}
                    </span>
                  )}
                </div>
                {(entry.priorValue !== undefined ||
                  entry.reconciledValue !== undefined) && (
                  <div
                    style={{
                      marginTop: 4,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 10, color: '#656d76' }}>
                        Prior
                      </div>
                      <pre style={{ margin: 0 }}>
                        {JSON.stringify(entry.priorValue, null, 2) ?? 'undefined'}
                      </pre>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 10, color: '#656d76' }}>
                        Reconciled
                      </div>
                      <pre style={{ margin: 0 }}>
                        {JSON.stringify(entry.reconciledValue, null, 2) ?? 'undefined'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <pre
            style={{
              fontSize: 12,
              overflow: 'auto',
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
            }}
          >
            No trace available
          </pre>
        )}
      </details>

      <details data-testid="panel-history" open={history.length > 1}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          History ({history.length})
          <button
            data-testid="btn-copy-history"
            onClick={(e) => {
              e.preventDefault();
              handleCopyHistory();
            }}
            style={{
              marginLeft: 12,
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 3,
              border: '1px solid #d0d7de',
              background: copyFeedback ? '#1a7f37' : '#f6f8fa',
              color: copyFeedback ? '#fff' : '#24292f',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {copyFeedback ? 'Copied' : 'Copy'}
          </button>
        </summary>
        <div
          style={{
            fontSize: 12,
            overflow: 'auto',
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            display: 'grid',
            gap: 4,
          }}
        >
          {history.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '4px 8px',
                borderRadius: 3,
                background:
                  entry.action === 'interaction' ? '#f0f6ff' : '#fff',
                border: '1px solid #e0e0e0',
                fontFamily: 'monospace',
                whiteSpace: 'pre',
              }}
            >
              <span style={{ color: '#656d76' }}>#{entry.seq}</span>{' '}
              <span style={{ fontWeight: 600 }}>{entry.action}</span>
              {entry.stepLabel && (
                <span style={{ color: '#656d76' }}> {entry.stepLabel}</span>
              )}
              {entry.trace && (
                <span style={{ color: '#0969da' }}>
                  {' '}
                  {Object.entries(entry.trace)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(' ')}
                </span>
              )}
              {entry.stateKeys && entry.stateKeys.length > 0 && (
                <span style={{ color: '#1a7f37' }}>
                  {' '}
                  state=[{entry.stateKeys.join(',')}]
                </span>
              )}
              {entry.issues && entry.issues.length > 0 && (
                <span style={{ color: '#d1242f' }}>
                  {' '}
                  {entry.issues.join(', ')}
                </span>
              )}
              {entry.components && (
                <span style={{ color: '#0969da' }}>
                  {' '}
                  [{entry.components.join(', ')}]
                </span>
              )}
            </div>
          ))}
        </div>
      </details>

      <details data-testid="panel-event-log">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Event Log ({log.length})
        </summary>
        <pre
          style={{
            fontSize: 12,
            overflow: 'auto',
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
          }}
        >
          {JSON.stringify(log, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function App() {
  return (
    <ContinuumProvider components={componentMap} persist="sessionStorage">
      <PlaygroundContent />
    </ContinuumProvider>
  );
}
