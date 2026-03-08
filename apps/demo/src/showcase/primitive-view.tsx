import { useEffect, useRef } from 'react';
import type { SessionOptions } from '@continuum/core';
import { ContinuumProvider, ContinuumRenderer, useContinuumSession } from '@continuum/starter-kit';
import { componentMap } from '../component-map';
import { color, radius, space } from '../ui/tokens';
import type { DemoExample } from './schemas';

const sessionOptions: SessionOptions = {
  actions: {
    'demo.submit': {
      registration: {
        label: 'Demo submit',
        description: 'Resolves the demo action',
      },
      handler: async () => {
        return { success: true, data: 'ok' };
      },
    },
  },
};

function ExampleRuntime({
  view,
  initialValues,
}: Pick<DemoExample, 'view' | 'initialValues'>) {
  const session = useContinuumSession();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    session.pushView(view);

    for (const [nodeId, nodeValue] of Object.entries(initialValues ?? {})) {
      session.updateState(nodeId, nodeValue);
    }
  }, [initialValues, session, view]);

  return <ContinuumRenderer view={view} />;
}

export function PrimitiveView({ example }: { example: DemoExample }) {
  return (
    <div
      style={{
        padding: space.xl,
        borderRadius: radius.md,
        background: color.surfaceMuted,
        border: `1px solid ${color.borderSoft}`,
      }}
    >
      <ContinuumProvider components={componentMap} persist={false} sessionOptions={sessionOptions}>
        <ExampleRuntime view={example.view} initialValues={example.initialValues} />
      </ContinuumProvider>
    </div>
  );
}
