import { useEffect } from 'react';
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitSessionWorkbench,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit';

export const starterReferencePackages = [
  '@continuum-dev/starter-kit',
  'react',
] as const;

export const starterReferenceView: ViewDefinition = {
  viewId: 'starter-reference',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Profile',
      children: [
        {
          id: 'name',
          type: 'field',
          dataType: 'string',
          key: 'name',
          label: 'Name',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'email',
          label: 'Email',
        },
      ],
    },
  ],
};

function StarterReferenceScreen() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!snapshot) {
      session.pushView(starterReferenceView);
    }
  }, [session, snapshot]);

  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}

export function StarterReferenceApp() {
  return (
    <ContinuumProvider
      components={starterKitComponentMap}
      persist="localStorage"
    >
      <StarterKitSessionWorkbench initialView={starterReferenceView} />
      <StarterReferenceScreen />
    </ContinuumProvider>
  );
}
