import type { CSSProperties, RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NodeValue, ViewDefinition } from '@continuum-dev/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import { componentMap } from '../../component-map';
import {
  collectScopedNodeIdsFromView,
  findScopedNodeIdByKey,
} from '../../playground/state/view-helpers';
import { StaticViewRenderer } from '../../playground/components/static-view-renderer';
import { useResponsiveState } from '../../ui/responsive';
import { color, radius, space, type } from '../../ui/tokens';

type HeroProofInteraction =
  | 'viewed'
  | 'autoplay_advanced'
  | 'submitted'
  | 'thinking';

type DemoSequencePhase =
  | 'idle'
  | 'prompt_typing'
  | 'submitted'
  | 'thinking'
  | 'morphing'
  | 'filling_company'
  | 'settled';

type DemoField = {
  key: string;
  label: string;
  initialNodeId?: string;
};

type ReplayResult = {
  view: ViewDefinition;
  values: Record<string, NodeValue>;
  status: string;
  fieldValues: Record<string, string>;
  hasStructuralLoss: boolean;
};

type CursorTarget =
  | 'hidden'
  | 'chat'
  | 'submit'
  | 'company_name'
  | 'company_role'
  | 'naive_identity'
  | 'continuum_identity'
  | 'naive_role'
  | 'continuum_role';

type CursorPosition = {
  left: number;
  top: number;
  visible: boolean;
};

const demoFields: DemoField[] = [
  { key: 'person.name', label: 'Full name', initialNodeId: 'full_name' },
  {
    key: 'person.email',
    label: 'Email address',
    initialNodeId: 'email_address',
  },
  { key: 'person.phone', label: 'Phone number', initialNodeId: 'phone_number' },
  { key: 'company.name', label: 'Company name' },
  { key: 'company.role', label: 'Your role' },
];

const inputValues: Record<string, string> = {
  'person.name': 'Bryton Cooper',
  'person.email': 'bryton@continuum.dev',
  'person.phone': '+1 555 0142',
  'company.name': 'Continuum Labs',
  'company.role': 'Product design',
};

const addCompanyPrompt = 'Can I save my company information too?';
const removeRolePrompt = 'I dont think I need to save my role.';
const restoreRolePrompt = 'I was wrong. I need to have my role.';

const initialView: ViewDefinition = {
  viewId: 'landing-proof-identity',
  version: '1',
  nodes: [
    {
      id: 'full_name',
      key: 'person.name',
      type: 'field',
      dataType: 'string',
      label: 'Full name',
      placeholder: 'Enter full name',
    },
    {
      id: 'email_address',
      key: 'person.email',
      type: 'field',
      dataType: 'string',
      label: 'Email address',
      placeholder: 'Enter email',
    },
    {
      id: 'phone_number',
      key: 'person.phone',
      type: 'field',
      dataType: 'string',
      label: 'Phone number',
      placeholder: 'Enter phone',
    },
  ],
};

const expandedView: ViewDefinition = {
  viewId: 'landing-proof-identity',
  version: '2',
  nodes: [
    {
      id: 'identity_details',
      type: 'group',
      label: 'Identity details',
      children: [
        {
          id: 'legal_name',
          key: 'person.name',
          type: 'field',
          dataType: 'string',
          label: 'Legal name',
          placeholder: 'Enter legal name',
        },
        {
          id: 'primary_email',
          key: 'person.email',
          type: 'field',
          dataType: 'string',
          label: 'Primary email',
          placeholder: 'Enter primary email',
        },
      ],
    },
    {
      id: 'contact_details',
      type: 'group',
      label: 'Contact details',
      children: [
        {
          id: 'phone_contact',
          key: 'person.phone',
          type: 'field',
          dataType: 'string',
          label: 'Phone contact',
          placeholder: 'Enter phone contact',
        },
        {
          id: 'company_information',
          type: 'group',
          label: 'Company information',
          children: [
            {
              id: 'registered_company',
              key: 'company.name',
              type: 'field',
              dataType: 'string',
              label: 'Registered company',
              placeholder: 'Enter registered company',
            },
            {
              id: 'company_role',
              key: 'company.role',
              type: 'field',
              dataType: 'string',
              label: 'Your role',
              placeholder: 'Enter your role',
            },
          ],
        },
      ],
    },
  ],
};

const roleRemovedView: ViewDefinition = {
  viewId: 'landing-proof-identity',
  version: '3',
  nodes: [
    {
      id: 'identity_details',
      type: 'group',
      label: 'Identity details',
      children: [
        {
          id: 'legal_name',
          key: 'person.name',
          type: 'field',
          dataType: 'string',
          label: 'Legal name',
          placeholder: 'Enter legal name',
        },
        {
          id: 'primary_email',
          key: 'person.email',
          type: 'field',
          dataType: 'string',
          label: 'Primary email',
          placeholder: 'Enter primary email',
        },
      ],
    },
    {
      id: 'contact_details',
      type: 'group',
      label: 'Contact details',
      children: [
        {
          id: 'phone_contact',
          key: 'person.phone',
          type: 'field',
          dataType: 'string',
          label: 'Phone contact',
          placeholder: 'Enter phone contact',
        },
        {
          id: 'company_information',
          type: 'group',
          label: 'Company information',
          children: [
            {
              id: 'registered_company',
              key: 'company.name',
              type: 'field',
              dataType: 'string',
              label: 'Registered company',
              placeholder: 'Enter registered company',
            },
          ],
        },
      ],
    },
  ],
};

const roleRestoredView: ViewDefinition = {
  viewId: 'landing-proof-identity',
  version: '4',
  nodes: [
    {
      id: 'identity_details',
      type: 'group',
      label: 'Identity details',
      children: [
        {
          id: 'legal_name',
          key: 'person.name',
          type: 'field',
          dataType: 'string',
          label: 'Legal name',
          placeholder: 'Enter legal name',
        },
        {
          id: 'primary_email',
          key: 'person.email',
          type: 'field',
          dataType: 'string',
          label: 'Primary email',
          placeholder: 'Enter primary email',
        },
      ],
    },
    {
      id: 'contact_details',
      type: 'group',
      label: 'Contact details',
      children: [
        {
          id: 'phone_contact',
          key: 'person.phone',
          type: 'field',
          dataType: 'string',
          label: 'Phone contact',
          placeholder: 'Enter phone contact',
        },
        {
          id: 'company_information',
          type: 'group',
          label: 'Company information',
          children: [
            {
              id: 'registered_company',
              key: 'company.name',
              type: 'field',
              dataType: 'string',
              label: 'Registered company',
              placeholder: 'Enter registered company',
            },
            {
              id: 'company_role_returned',
              key: 'company.role',
              type: 'field',
              dataType: 'string',
              label: 'Role',
              placeholder: 'Enter role',
            },
          ],
        },
      ],
    },
  ],
};

const demoSteps = [
  initialView,
  expandedView,
  roleRemovedView,
  roleRestoredView,
] as const;

const moduleStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  position: 'relative',
  overflowAnchor: 'none',
};

const chatShellStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  padding: space.md,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
};

const chatLabelStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
};

const chatRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: space.sm,
  alignItems: 'center',
};

const chatInputStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  border: `1px solid ${color.borderSoft}`,
  borderRadius: radius.md,
  background: color.surfaceMuted,
  minHeight: 38,
  padding: `${space.sm}px ${space.md}px`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const submitButtonStyle = (phase: DemoSequencePhase): CSSProperties => ({
  ...type.small,
  color: color.surface,
  border: `1px solid ${color.accentStrong}`,
  borderRadius: radius.pill,
  background: color.accent,
  minHeight: 34,
  minWidth: 74,
  padding: `${space.xs}px ${space.md}px`,
  cursor: 'pointer',
  transform: phase === 'submitted' ? 'scale(0.94)' : 'scale(1)',
  opacity: phase === 'prompt_typing' ? 0.92 : 1,
  transition: 'transform 180ms ease, opacity 180ms ease',
});

const panelsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.md,
};

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  padding: space.md,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
};

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space.sm,
  flexWrap: 'wrap',
  minHeight: 36,
};

const panelTitleStyle = (tone: 'naive' | 'continuum'): CSSProperties => ({
  ...type.section,
  color: color.surface,
  borderRadius: radius.pill,
  padding: `${space.xs}px ${space.sm}px`,
  background: tone === 'continuum' ? color.success : color.danger,
});

const statusStyle = (
  tone: 'naive' | 'continuum',
  isPositive: boolean
): CSSProperties => ({
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
  maxWidth: 220,
  color:
    tone === 'continuum'
      ? color.success
      : isPositive
      ? color.text
      : color.danger,
  border: `1px solid ${
    tone === 'continuum'
      ? color.success
      : isPositive
      ? color.border
      : color.danger
  }`,
  borderRadius: radius.pill,
  padding: `${space.xs}px ${space.sm}px`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  background:
    tone === 'continuum'
      ? color.successSoft
      : isPositive
      ? color.surfaceMuted
      : color.dangerSoft,
});

const previewStyle = (
  tone: 'naive' | 'continuum',
  isAnimating: boolean,
  morphOpacity: number,
  height: number
): CSSProperties => ({
  border: `1px solid ${tone === 'continuum' ? color.success : color.border}`,
  borderRadius: radius.md,
  padding: space.md,
  background: tone === 'continuum' ? color.successSoft : color.surfaceMuted,
  height,
  pointerEvents: 'none',
  overflow: 'visible',
  transition:
    'transform 360ms ease, opacity 360ms ease, border-color 360ms ease',
  transform: isAnimating ? 'scale(0.985) translateY(1px)' : 'scale(1)',
  opacity: (isAnimating ? 0.72 : 1) * morphOpacity,
  position: 'relative',
});

function proofPreviewHeight(isMobile: boolean) {
  return isMobile ? 700 : 580;
}

const previewViewportStyle: CSSProperties = {
  position: 'relative',
  height: '100%',
  overflow: 'hidden',
  borderRadius: radius.sm,
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: radius.sm,
  background:
    'linear-gradient(120deg, rgba(22,32,51,0.02) 0%, rgba(22,32,51,0.12) 50%, rgba(22,32,51,0.02) 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

const overlayTextStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  padding: `${space.xs}px ${space.sm}px`,
};

const cursorStyle = (
  position: CursorPosition,
  isPressed: boolean
): CSSProperties => {
  return {
    position: 'absolute',
    left: position.left,
    top: position.top,
    width: 34,
    height: 34,
    transform: `translate(-50%, -50%) scale(${isPressed ? 0.88 : 1})`,
    transition:
      'left 480ms cubic-bezier(0.22, 1, 0.36, 1), top 480ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms ease, opacity 180ms ease',
    opacity: position.visible ? 1 : 0,
    pointerEvents: 'none',
    zIndex: 5,
  };
};

const cursorGlowStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 999,
  background:
    'radial-gradient(circle, rgba(117,138,255,0.38) 0%, rgba(117,138,255,0.16) 45%, rgba(117,138,255,0) 72%)',
};

const cursorRingStyle: CSSProperties = {
  position: 'absolute',
  inset: 5,
  borderRadius: 999,
  border: `2px solid ${color.accent}`,
  boxShadow: '0 0 0 1px rgba(255,255,255,0.78) inset',
  background: 'rgba(255,255,255,0.6)',
};

const outcomePopoverStyle = (
  tone: 'danger' | 'warning' | 'success',
  side: 'naive' | 'continuum',
  top: string,
  isMobile: boolean
): CSSProperties => ({
  position: 'absolute',
  top,
  ...(isMobile
    ? side === 'naive'
      ? { left: 10 }
      : { right: 10 }
    : side === 'naive'
    ? { left: 6, transform: 'translateX(-100%)' }
    : { right: 6, transform: 'translateX(100%)' }),
  ...type.small,
  color:
    tone === 'danger'
      ? color.danger
      : tone === 'warning'
      ? color.highlight
      : color.success,
  background:
    tone === 'danger'
      ? color.surface
      : tone === 'warning'
      ? color.surface
      : color.surface,
  border: `1px solid ${
    tone === 'danger'
      ? color.danger
      : tone === 'warning'
      ? color.highlight
      : color.success
  }`,
  borderRadius: radius.md,
  padding: `${space.xs}px ${space.sm}px`,
  boxShadow: '0 10px 24px rgba(22, 32, 51, 0.12)',
  pointerEvents: 'none',
  zIndex: 2,
  maxWidth: isMobile ? 120 : 170,
});

function renderOutcomePopover(
  side: 'naive' | 'continuum',
  stepIndex: number,
  phase: DemoSequencePhase,
  isMobile: boolean
) {
  if (phase === 'thinking' || phase === 'morphing') {
    return null;
  }

  if (stepIndex === 1) {
    if (side === 'naive') {
      return (
        <div
          style={outcomePopoverStyle(
            'danger',
            side,
            isMobile ? '10%' : '20%',
            isMobile
          )}
        >
          User data lost
        </div>
      );
    }

    return (
      <div
        style={outcomePopoverStyle(
          'success',
          side,
          isMobile ? '10%' : '20%',
          isMobile
        )}
      >
        Values carried forward
      </div>
    );
  }

  if (stepIndex === 2) {
    if (side === 'naive') {
      return (
        <div
          style={outcomePopoverStyle(
            'danger',
            side,
            isMobile ? '58%' : '68%',
            isMobile
          )}
        >
          User data lost
        </div>
      );
    }

    return (
      <div
        style={outcomePopoverStyle(
          'warning',
          side,
          isMobile ? '58%' : '68%',
          isMobile
        )}
      >
        Value detached safely
      </div>
    );
  }

  if (stepIndex === 3) {
    if (side === 'naive') {
      return (
        <div
          style={outcomePopoverStyle(
            'danger',
            side,
            isMobile ? '66%' : '76%',
            isMobile
          )}
        >
          User data lost
        </div>
      );
    }

    return (
      <div
        style={outcomePopoverStyle(
          'success',
          side,
          isMobile ? '66%' : '76%',
          isMobile
        )}
      >
        Value restored
      </div>
    );
  }

  return null;
}

function getThinkingLabel(stepIndex: number) {
  if (stepIndex === 0) {
    return 'Adding company fields...';
  }
  if (stepIndex === 1) {
    return 'Removing the role field...';
  }
  return 'Bringing the role field back...';
}

function buildNaiveReplay(
  stepIndex: number,
  companyNameValue: string,
  companyRoleValue: string
): ReplayResult {
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, demoSteps.length - 1)
  );
  let currentView = demoSteps[0];
  let values: Record<string, NodeValue> = {};

  for (const field of demoFields) {
    if (!field.initialNodeId) {
      continue;
    }
    values[field.initialNodeId] = {
      value: inputValues[field.key],
      isDirty: true,
    };
  }

  for (let index = 1; index <= boundedStepIndex; index += 1) {
    currentView = demoSteps[index];
    const allowedNodeIds = new Set(collectScopedNodeIdsFromView(currentView));
    values = Object.fromEntries(
      Object.entries(values).filter(([nodeId]) => allowedNodeIds.has(nodeId))
    );

    {
      const companyNodeId = findScopedNodeIdByKey(currentView, 'company.name');
      const roleNodeId = findScopedNodeIdByKey(currentView, 'company.role');
      if (companyNodeId && companyNameValue) {
        values[companyNodeId] = {
          value: companyNameValue,
          isDirty: true,
        };
      }
      if (index === 1 && roleNodeId && companyRoleValue) {
        values[roleNodeId] = {
          value: companyRoleValue,
          isDirty: true,
        };
      }
    }
  }

  const fieldValues = Object.fromEntries(
    demoFields.map((field) => {
      const nodeId = findScopedNodeIdByKey(currentView, field.key);
      const storedValue = nodeId ? values[nodeId]?.value : undefined;
      return [field.key, String(storedValue ?? '')];
    })
  ) as Record<string, string>;
  const hasStructuralLoss =
    boundedStepIndex >= 1 &&
    (!fieldValues['person.name'] ||
      !fieldValues['person.email'] ||
      !fieldValues['person.phone']);

  const status =
    boundedStepIndex === 0
      ? 'Personal fields filled'
      : boundedStepIndex === 1
      ? hasStructuralLoss
        ? 'Earlier fields lost on regenerate'
        : companyNameValue || companyRoleValue
        ? 'Company section added'
        : 'New fields are blank'
      : boundedStepIndex === 2
      ? 'Role data lost'
      : 'Role field came back empty';

  return {
    view: currentView,
    values,
    status,
    fieldValues,
    hasStructuralLoss,
  };
}

function ContinuumRuntimePreview({
  stepIndex,
  isAnimating,
  phase,
  morphOpacity,
  companyNameValue,
  companyRoleValue,
  panelRef,
  isMobile,
  previewHeight,
}: {
  stepIndex: number;
  isAnimating: boolean;
  phase: DemoSequencePhase;
  morphOpacity: number;
  companyNameValue: string;
  companyRoleValue: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  previewHeight: number;
}) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, demoSteps.length - 1)
  );

  useEffect(() => {
    session.reset();
    const baseView = demoSteps[0];

    session.pushView(baseView);
    for (const field of demoFields) {
      const initialNodeId = findScopedNodeIdByKey(baseView, field.key);
      if (!initialNodeId) {
        continue;
      }

      session.updateState(initialNodeId, {
        value: inputValues[field.key],
        isDirty: true,
      });
    }

    for (let index = 1; index <= boundedStepIndex; index += 1) {
      session.pushView(demoSteps[index]);
      const currentView = demoSteps[index];
      const companyNodeId = findScopedNodeIdByKey(currentView, 'company.name');
      const roleNodeId = findScopedNodeIdByKey(currentView, 'company.role');
      if (companyNodeId && companyNameValue) {
        session.updateState(companyNodeId, {
          value: companyNameValue,
          isDirty: true,
        });
      }
      if (index === 1 && roleNodeId && companyRoleValue) {
        session.updateState(roleNodeId, {
          value: companyRoleValue,
          isDirty: true,
        });
      }
    }
  }, [boundedStepIndex, companyNameValue, companyRoleValue, session]);

  const currentView = snapshot?.view ?? demoSteps[boundedStepIndex];
  const values = snapshot?.data.values ?? {};
  const detachedValues = snapshot?.data.detachedValues ?? {};
  const fieldValues = Object.fromEntries(
    demoFields.map((field) => {
      const nodeId = findScopedNodeIdByKey(currentView, field.key);
      const currentValue = nodeId ? values[nodeId]?.value : undefined;
      return [field.key, String(currentValue ?? '')];
    })
  ) as Record<string, string>;
  const hasDetachedRole = Boolean(detachedValues['company.role']);
  const status =
    boundedStepIndex === 0
      ? 'Personal fields filled'
      : boundedStepIndex === 1
      ? fieldValues['person.name'] &&
        fieldValues['person.email'] &&
        fieldValues['person.phone']
        ? companyNameValue || companyRoleValue
          ? 'Renamed fields kept their values'
          : 'Existing values carried forward'
        : 'Reconciliation still in progress'
      : boundedStepIndex === 2
      ? hasDetachedRole
        ? 'Role detached safely'
        : 'Processing detached value'
      : fieldValues['company.role']
      ? 'Role restored'
      : 'Waiting to restore';

  return (
    <div ref={panelRef} style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div style={panelTitleStyle('continuum')}>WITH CONTINUUM</div>
        <div style={statusStyle('continuum', true)}>{status}</div>
      </div>
      <div
        style={previewStyle(
          'continuum',
          isAnimating,
          morphOpacity,
          previewHeight
        )}
      >
        <div style={previewViewportStyle}>
          <ContinuumRenderer view={currentView} />
        </div>
        {renderOutcomePopover('continuum', boundedStepIndex, phase, isMobile)}
        {phase === 'thinking' ? (
          <div style={overlayStyle}>
            <div style={overlayTextStyle}>
              {getThinkingLabel(boundedStepIndex)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HeroProofModule({
  onInteraction,
}: {
  onInteraction?: (interaction: HeroProofInteraction) => void;
}) {
  const { isMobile } = useResponsiveState();
  const moduleRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLDivElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const naivePanelRef = useRef<HTMLDivElement | null>(null);
  const continuumPanelRef = useRef<HTMLDivElement | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<DemoSequencePhase>('idle');
  const [typedLength, setTypedLength] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [morphOpacity, setMorphOpacity] = useState(1);
  const [companyNameLength, setCompanyNameLength] = useState(0);
  const [companyRoleLength, setCompanyRoleLength] = useState(0);
  const [cursorTarget, setCursorTarget] = useState<CursorTarget>('hidden');
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    left: 0,
    top: 0,
    visible: false,
  });
  const [cursorPressed, setCursorPressed] = useState(false);
  const [isModuleVisible, setIsModuleVisible] = useState(true);
  const viewedRef = useRef(false);
  const cycleVersionRef = useRef(0);

  useEffect(() => {
    if (viewedRef.current) {
      return;
    }

    viewedRef.current = true;
    onInteraction?.('viewed');
  }, [onInteraction]);

  useEffect(() => {
    const moduleElement = moduleRef.current;
    if (!moduleElement || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsModuleVisible(entry.isIntersecting);
      },
      {
        threshold: 0.2,
      }
    );

    observer.observe(moduleElement);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const moduleElement = moduleRef.current;
    if (!moduleElement) {
      return;
    }

    const resolveTarget = () => {
      if (cursorTarget === 'chat') {
        return chatInputRef.current;
      }
      if (cursorTarget === 'submit') {
        return submitButtonRef.current;
      }
      if (cursorTarget === 'company_name') {
        return continuumPanelRef.current?.querySelector(
          '[data-continuum-node-id="contact_details/company_information/registered_company"] [data-continuum-control="true"]'
        ) as HTMLElement | null;
      }
      if (cursorTarget === 'company_role') {
        return continuumPanelRef.current?.querySelector(
          '[data-continuum-node-id="contact_details/company_information/company_role"] [data-continuum-control="true"]'
        ) as HTMLElement | null;
      }
      return null;
    };

    const updatePosition = () => {
      const moduleRect = moduleElement.getBoundingClientRect();
      const naivePanelRect =
        naivePanelRef.current?.getBoundingClientRect() ?? null;
      const panelRect =
        continuumPanelRef.current?.getBoundingClientRect() ?? null;
      const chatRect = chatInputRef.current?.getBoundingClientRect() ?? null;

      if (cursorTarget === 'hidden') {
        if (panelRect) {
          setCursorPosition({
            left:
              panelRect.left -
              moduleRect.left +
              panelRect.width * (isMobile ? 0.52 : 0.6),
            top: panelRect.top - moduleRect.top + panelRect.height * 0.34,
            visible: true,
          });
          return;
        }

        if (chatRect) {
          setCursorPosition({
            left: chatRect.left - moduleRect.left + chatRect.width * 0.82,
            top: chatRect.top - moduleRect.top + chatRect.height * 0.52,
            visible: true,
          });
          return;
        }

        setCursorPosition({
          left: moduleRect.width * 0.62,
          top: moduleRect.height * 0.4,
          visible: true,
        });
        return;
      }

      if (cursorTarget === 'naive_identity' && naivePanelRect) {
        setCursorPosition({
          left:
            naivePanelRect.left -
            moduleRect.left +
            naivePanelRect.width * (isMobile ? 0.56 : 0.6),
          top:
            naivePanelRect.top -
            moduleRect.top +
            naivePanelRect.height * (isMobile ? 0.7 : 0.67),
          visible: true,
        });
        return;
      }

      if (cursorTarget === 'continuum_identity' && panelRect) {
        setCursorPosition({
          left:
            panelRect.left -
            moduleRect.left +
            panelRect.width * (isMobile ? 0.56 : 0.6),
          top:
            panelRect.top -
            moduleRect.top +
            panelRect.height * (isMobile ? 0.7 : 0.67),
          visible: true,
        });
        return;
      }

      if (cursorTarget === 'company_name' && panelRect) {
        setCursorPosition({
          left:
            panelRect.left -
            moduleRect.left +
            panelRect.width * (isMobile ? 0.56 : 0.7),
          top: panelRect.top - moduleRect.top + panelRect.height * 0.54,
          visible: true,
        });
        return;
      }

      if (cursorTarget === 'naive_role' && naivePanelRect) {
        setCursorPosition({
          left:
            naivePanelRect.left -
            moduleRect.left +
            naivePanelRect.width * (isMobile ? 0.56 : 0.62),
          top:
            naivePanelRect.top -
            moduleRect.top +
            naivePanelRect.height * (isMobile ? 0.84 : 0.83),
          visible: true,
        });
        return;
      }

      if (cursorTarget === 'company_role' && panelRect) {
        setCursorPosition({
          left:
            panelRect.left -
            moduleRect.left +
            panelRect.width * (isMobile ? 0.58 : 0.72),
          top: panelRect.top - moduleRect.top + panelRect.height * 0.7,
          visible: true,
        });
        return;
      }

      if (cursorTarget === 'continuum_role' && panelRect) {
        setCursorPosition({
          left:
            panelRect.left -
            moduleRect.left +
            panelRect.width * (isMobile ? 0.56 : 0.62),
          top:
            panelRect.top -
            moduleRect.top +
            panelRect.height * (isMobile ? 0.84 : 0.83),
          visible: true,
        });
        return;
      }

      const targetElement = resolveTarget();
      if (!targetElement) {
        if (panelRect) {
          setCursorPosition({
            left:
              panelRect.left -
              moduleRect.left +
              panelRect.width * (isMobile ? 0.52 : 0.6),
            top: panelRect.top - moduleRect.top + panelRect.height * 0.34,
            visible: true,
          });
          return;
        }

        setCursorPosition({
          left: moduleRect.width * 0.62,
          top: moduleRect.height * 0.4,
          visible: true,
        });
        return;
      }

      const targetRect = targetElement.getBoundingClientRect();
      setCursorPosition({
        left: targetRect.left - moduleRect.left + targetRect.width * 0.78,
        top: targetRect.top - moduleRect.top + targetRect.height * 0.56,
        visible: true,
      });
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updatePosition);
    };
  }, [
    companyNameLength,
    companyRoleLength,
    cursorTarget,
    isMobile,
    morphOpacity,
    stepIndex,
  ]);

  useEffect(() => {
    if (!isModuleVisible) {
      return;
    }

    const cycleId = cycleVersionRef.current + 1;
    cycleVersionRef.current = cycleId;

    const timeoutIds: number[] = [];
    const intervalIds: number[] = [];

    const clearTimers = () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      for (const intervalId of intervalIds) {
        window.clearInterval(intervalId);
      }
    };

    const addTimeout = (callback: () => void, ms: number) => {
      const id = window.setTimeout(callback, ms);
      timeoutIds.push(id);
      return id;
    };

    const addInterval = (callback: () => void, ms: number) => {
      const id = window.setInterval(callback, ms);
      intervalIds.push(id);
      return id;
    };

    const pressCursor = () => {
      setCursorPressed(true);
      addTimeout(() => {
        setCursorPressed(false);
      }, 120);
    };

    const focusCursor = (target: CursorTarget, startMs: number) => {
      addTimeout(() => {
        setCursorTarget(target);
      }, startMs);
    };

    const typePrompt = (prompt: string, startMs: number) => {
      addTimeout(() => {
        setCursorTarget('chat');
        setCurrentPrompt(prompt);
        setTypedLength(0);
        setPhase('prompt_typing');
        const promptIntervalId = addInterval(() => {
          setTypedLength((currentValue) => {
            const nextValue = Math.min(currentValue + 1, prompt.length);
            if (nextValue >= prompt.length) {
              window.clearInterval(promptIntervalId);
            }
            return nextValue;
          });
        }, 58);
      }, startMs);
      return prompt.length * 58;
    };

    const fillCompanyField = (
      target: CursorTarget,
      setter: (value: number | ((currentValue: number) => number)) => void,
      finalValue: string,
      startMs: number
    ) => {
      addTimeout(() => {
        setCursorTarget(target);
        setPhase('filling_company');
        setter(0);
        const fieldIntervalId = addInterval(() => {
          setter((currentValue) => {
            const nextValue = Math.min(currentValue + 1, finalValue.length);
            if (nextValue >= finalValue.length) {
              window.clearInterval(fieldIntervalId);
            }
            return nextValue;
          });
        }, 42);
      }, startMs);
      return finalValue.length * 42;
    };

    const runCycle = () => {
      if (cycleVersionRef.current !== cycleId) {
        return;
      }
      setStepIndex(0);
      setPhase('idle');
      setTypedLength(0);
      setCurrentPrompt('');
      setMorphOpacity(1);
      setCompanyNameLength(0);
      setCompanyRoleLength(0);
      setCursorTarget('hidden');
      setCursorPressed(false);

      let cursorMs = 1600;

      const addCompanyTypingDuration = typePrompt(addCompanyPrompt, cursorMs);
      cursorMs += addCompanyTypingDuration + 420;

      addTimeout(() => {
        setCursorTarget('submit');
        setPhase('submitted');
        pressCursor();
        onInteraction?.('submitted');
      }, cursorMs);
      cursorMs += 700;

      addTimeout(() => {
        setPhase('thinking');
        setCursorTarget('hidden');
        onInteraction?.('thinking');
      }, cursorMs);
      cursorMs += 1450;

      addTimeout(() => {
        setPhase('morphing');
        setMorphOpacity(0);
      }, cursorMs);
      cursorMs += 260;

      addTimeout(() => {
        setStepIndex(1);
        setMorphOpacity(1);
        onInteraction?.('autoplay_advanced');
        setPhase('settled');
      }, cursorMs);
      cursorMs += 750;

      focusCursor('naive_identity', cursorMs);
      cursorMs += 1250;

      focusCursor('continuum_identity', cursorMs);
      cursorMs += 1450;

      const companyNameTypingDuration = fillCompanyField(
        'company_name',
        setCompanyNameLength,
        inputValues['company.name'],
        cursorMs
      );
      cursorMs += companyNameTypingDuration + 520;

      const companyRoleTypingDuration = fillCompanyField(
        'company_role',
        setCompanyRoleLength,
        inputValues['company.role'],
        cursorMs
      );
      cursorMs += companyRoleTypingDuration + 1200;

      const removeRoleTypingDuration = typePrompt(removeRolePrompt, cursorMs);
      cursorMs += removeRoleTypingDuration + 420;

      addTimeout(() => {
        setCursorTarget('submit');
        setPhase('submitted');
        pressCursor();
        onInteraction?.('submitted');
      }, cursorMs);
      cursorMs += 700;

      addTimeout(() => {
        setPhase('thinking');
        setCursorTarget('hidden');
        onInteraction?.('thinking');
      }, cursorMs);
      cursorMs += 1350;

      addTimeout(() => {
        setPhase('morphing');
        setMorphOpacity(0);
      }, cursorMs);
      cursorMs += 260;

      addTimeout(() => {
        setStepIndex(2);
        setMorphOpacity(1);
        onInteraction?.('autoplay_advanced');
        setPhase('settled');
      }, cursorMs);
      cursorMs += 850;

      focusCursor('naive_role', cursorMs);
      cursorMs += 1000;

      focusCursor('continuum_role', cursorMs);
      cursorMs += 1450;

      const restoreRoleTypingDuration = typePrompt(restoreRolePrompt, cursorMs);
      cursorMs += restoreRoleTypingDuration + 420;

      addTimeout(() => {
        setCursorTarget('submit');
        setPhase('submitted');
        pressCursor();
        onInteraction?.('submitted');
      }, cursorMs);
      cursorMs += 700;

      addTimeout(() => {
        setPhase('thinking');
        setCursorTarget('hidden');
        onInteraction?.('thinking');
      }, cursorMs);
      cursorMs += 1350;

      addTimeout(() => {
        setPhase('morphing');
        setMorphOpacity(0);
      }, cursorMs);
      cursorMs += 260;

      addTimeout(() => {
        setStepIndex(3);
        setMorphOpacity(1);
        onInteraction?.('autoplay_advanced');
        setPhase('settled');
      }, cursorMs);
      cursorMs += 850;

      focusCursor('naive_role', cursorMs);
      cursorMs += 1000;

      focusCursor('continuum_role', cursorMs);
      cursorMs += 2000;

      addTimeout(runCycle, cursorMs);
    };

    runCycle();
    return clearTimers;
  }, [isModuleVisible, onInteraction]);

  const companyNameValue = inputValues['company.name'].slice(
    0,
    companyNameLength
  );
  const companyRoleValue = inputValues['company.role'].slice(
    0,
    companyRoleLength
  );
  const previewHeight = proofPreviewHeight(isMobile);
  const naiveReplay = useMemo(
    () => buildNaiveReplay(stepIndex, companyNameValue, companyRoleValue),
    [companyNameValue, companyRoleValue, stepIndex]
  );
  const isAnimating = phase === 'thinking' || phase === 'morphing';
  const chatText =
    phase === 'prompt_typing'
      ? currentPrompt.slice(0, typedLength)
      : currentPrompt;
  const showChatCaret =
    phase === 'prompt_typing' && typedLength < currentPrompt.length;

  return (
    <div ref={moduleRef} style={moduleStyle}>
      <div style={chatShellStyle}>
        <div style={chatLabelStyle}>
          {phase === 'idle'
            ? 'Starting with name, email, and phone'
            : phase === 'filling_company'
            ? 'New company fields are being filled'
            : 'User asks AI to change the form'}
        </div>
        <div style={chatRowStyle}>
          <div ref={chatInputRef} style={chatInputStyle}>
            {chatText}
            {showChatCaret ? '|' : ''}
          </div>
          <button
            ref={submitButtonRef}
            type="button"
            style={submitButtonStyle(phase)}
          >
            Submit
          </button>
        </div>
      </div>
      <div
        style={{
          ...panelsGridStyle,
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr)'
            : panelsGridStyle.gridTemplateColumns,
        }}
      >
        <div ref={naivePanelRef} style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div style={panelTitleStyle('naive')}>WITHOUT CONTINUUM</div>
            <div
              style={statusStyle(
                'naive',
                !naiveReplay.hasStructuralLoss && stepIndex === 0
              )}
            >
              {naiveReplay.status}
            </div>
          </div>
          <div
            style={{
              ...previewStyle(
                'naive',
                isAnimating,
                morphOpacity,
                previewHeight
              ),
              borderColor:
                naiveReplay.hasStructuralLoss || stepIndex >= 2
                  ? color.danger
                  : color.border,
              background:
                naiveReplay.hasStructuralLoss || stepIndex >= 2
                  ? color.dangerSoft
                  : color.surfaceMuted,
            }}
          >
            <div style={previewViewportStyle}>
              <StaticViewRenderer
                view={naiveReplay.view}
                values={naiveReplay.values as Record<string, NodeValue>}
                onChange={() => undefined}
              />
            </div>
            {renderOutcomePopover('naive', stepIndex, phase, isMobile)}
            {phase === 'thinking' ? (
              <div style={overlayStyle}>
                <div style={overlayTextStyle}>
                  {getThinkingLabel(stepIndex)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <ContinuumProvider components={componentMap} persist={false}>
          <ContinuumRuntimePreview
            stepIndex={stepIndex}
            isAnimating={isAnimating}
            phase={phase}
            morphOpacity={morphOpacity}
            companyNameValue={companyNameValue}
            companyRoleValue={companyRoleValue}
            panelRef={continuumPanelRef}
            isMobile={isMobile}
            previewHeight={previewHeight}
          />
        </ContinuumProvider>
      </div>
      <div style={cursorStyle(cursorPosition, cursorPressed)}>
        <div style={cursorGlowStyle} />
        <div style={cursorRingStyle} />
      </div>
    </div>
  );
}
