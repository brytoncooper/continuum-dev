import type { CSSProperties, ReactNode } from 'react';
import { color, space, type } from '../../tokens.js';
import {
  starterKitDefaultStyles,
  useStarterKitStyle,
} from '../../style-config.js';
import { StarterKitFieldProposal } from '../../proposals/field-proposal.js';
import { useFieldProposalPlacement } from '../../proposals/field-proposal-placement-context.js';
import { StarterKitFieldRestoreBadge } from '../../proposals/restore-badge.js';
import { streamedNodeMotionStyle } from './motion.js';

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  minWidth: 0,
  boxSizing: 'border-box',
};

const labelRowStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const labelLineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.xs,
  flexWrap: 'wrap',
};

const labelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const descriptionStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

export const controlStyle: CSSProperties = starterKitDefaultStyles.fieldControl;

export function inputLikeStyle(overrides?: CSSProperties): CSSProperties {
  return {
    ...controlStyle,
    ...overrides,
  };
}

export function useInputLikeStyle(overrides?: CSSProperties): CSSProperties {
  return useStarterKitStyle('fieldControl', inputLikeStyle(overrides));
}

export function FieldFrame({
  as = 'label',
  nodeId,
  label,
  labelId,
  description,
  descriptionId,
  hasSuggestion,
  suggestionValue,
  currentValue,
  onAcceptSuggestion,
  onRejectSuggestion,
  children,
}: {
  as?: 'div' | 'label';
  nodeId?: string;
  label?: string;
  labelId?: string;
  description?: string;
  descriptionId?: string;
  hasSuggestion?: boolean;
  suggestionValue?: unknown;
  currentValue?: unknown;
  onAcceptSuggestion?: () => void;
  onRejectSuggestion?: () => void;
  children: ReactNode;
}) {
  const Root = as;
  const proposalPlacement = useFieldProposalPlacement();
  const showProposal = Boolean(
    nodeId &&
      hasSuggestion &&
      onAcceptSuggestion &&
      onRejectSuggestion
  );

  const proposalBlock =
    showProposal && onAcceptSuggestion && onRejectSuggestion ? (
      <StarterKitFieldProposal
        title={label ?? 'Suggestion'}
        hasSuggestion={Boolean(hasSuggestion)}
        currentValue={currentValue}
        suggestionValue={suggestionValue}
        currentLabel="Current value"
        nextLabel="Suggested"
        bannerVariant={proposalPlacement === 'adjacent' ? 'popover' : 'card'}
        onAccept={onAcceptSuggestion}
        onReject={onRejectSuggestion}
      />
    ) : null;

  const inner = (
    <Root
      style={{
        ...wrapStyle,
        ...streamedNodeMotionStyle(nodeId, 'shell'),
      }}
      data-continuum-animated="field"
      data-continuum-node-shell="true"
      data-continuum-node-id={nodeId}
    >
      {label || description ? (
        <div
          data-continuum-animated-child="label"
          style={{
            ...labelRowStyle,
            ...streamedNodeMotionStyle(nodeId, 'content'),
          }}
        >
          {label ? (
            <div style={labelLineStyle}>
              <span id={labelId} style={labelStyle}>
                {label}
              </span>
              <StarterKitFieldRestoreBadge nodeId={nodeId} />
            </div>
          ) : nodeId ? (
            <StarterKitFieldRestoreBadge nodeId={nodeId} />
          ) : null}
          {description ? (
            <span id={descriptionId} style={descriptionStyle}>
              {description}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        data-continuum-animated-child="control"
        style={streamedNodeMotionStyle(nodeId, 'content')}
      >
        {children}
      </div>
      {proposalPlacement === 'below' ? proposalBlock : null}
    </Root>
  );

  if (proposalPlacement === 'adjacent' && showProposal) {
    return (
      <div
        className="continuum-adjacent-proposal-anchor"
        style={{
          position: 'relative',
          display: 'grid',
          minWidth: 0,
        }}
      >
        <style>
          {`
            .continuum-adjacent-proposal-anchor:hover .continuum-adjacent-proposal-panel,
            .continuum-adjacent-proposal-anchor:focus-within .continuum-adjacent-proposal-panel {
              opacity: 1;
              pointer-events: auto;
            }
          `}
        </style>
        {inner}
        <div
          className="continuum-adjacent-proposal-panel"
          data-continuum-adjacent-proposal-panel="true"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 2,
            maxWidth: 'min(320px, 100%)',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 120ms ease-out',
          }}
        >
          {proposalBlock}
        </div>
      </div>
    );
  }

  return inner;
}
