import { useState } from 'react';
import {
  ContinuumProvider,
  StarterKitSessionWorkbench,
  StarterKitStyleProvider,
  starterKitComponentMap,
  starterKitDefaultStyles,
} from '@continuum-dev/starter-kit';
import { baselineView } from './baseline-view';
import { MainShell } from './main-shell';

export default function App() {
  const [chatResetKey, setChatResetKey] = useState(0);

  return (
    <StarterKitStyleProvider styles={starterKitDefaultStyles}>
      <ContinuumProvider
        components={starterKitComponentMap}
        persist="localStorage"
      >
        <StarterKitSessionWorkbench
          initialView={baselineView}
          onAfterSessionReset={() => {
            setChatResetKey((key) => key + 1);
          }}
        />
        <MainShell chatResetKey={chatResetKey} />
      </ContinuumProvider>
    </StarterKitStyleProvider>
  );
}
