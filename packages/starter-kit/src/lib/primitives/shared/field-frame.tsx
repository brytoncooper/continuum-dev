import type { CSSProperties, ReactNode } from 'react';
import { color, space, type } from '../../tokens.js';
import { starterKitDefaultStyles, useStarterKitStyle } from '../../style-config.js';
import { StarterKitFieldProposal } from '../../proposals/field-proposal.js';
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
  nodeId,
  label,
  description,
  hasSuggestion,
  suggestionValue,
  currentValue,
  onAcceptSuggestion,
  onRejectSuggestion,
  children,
}: {
  nodeId?: string;
  label?: string;
  description?: string;
  hasSuggestion?: boolean;
  suggestionValue?: unknown;
  currentValue?: unknown;
  onAcceptSuggestion?: () => void;
  onRejectSuggestion?: () => void;
  children: ReactNode;
}) {
  return (
    <label
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
          {label ? <span style={labelStyle}>{label}</span> : null}
          {description ? <span style={descriptionStyle}>{description}</span> : null}
        </div>
      ) : null}
      <div
        data-continuum-animated-child="control"
        style={streamedNodeMotionStyle(nodeId, 'content')}
      >
        {children}
      </div>
      {nodeId && hasSuggestion && onAcceptSuggestion && onRejectSuggestion ? (
        <StarterKitFieldProposal
          title={label ?? 'Field suggestion'}
          hasSuggestion={Boolean(hasSuggestion)}
          currentValue={currentValue}
          suggestionValue={suggestionValue}
          currentLabel="Current value"
          nextLabel="AI suggestion"
          onAccept={onAcceptSuggestion}
          onReject={onRejectSuggestion}
        />
      ) : null}
    </label>
  );
}
