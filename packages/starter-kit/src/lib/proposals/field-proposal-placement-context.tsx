import { createContext, useContext, type ReactNode } from 'react';

export type FieldProposalPlacement = 'below' | 'adjacent';

const FieldProposalPlacementContext = createContext<FieldProposalPlacement>('below');

/**
 * Sets how field-level AI suggestions (accept/reject) are laid out for descendant fields.
 * Use `adjacent` to keep controls compact with a hover-revealed panel.
 */
export function FieldProposalPlacementProvider({
  value,
  children,
}: {
  value: FieldProposalPlacement;
  children: ReactNode;
}) {
  return (
    <FieldProposalPlacementContext.Provider value={value}>
      {children}
    </FieldProposalPlacementContext.Provider>
  );
}

export function useFieldProposalPlacement(): FieldProposalPlacement {
  return useContext(FieldProposalPlacementContext);
}
