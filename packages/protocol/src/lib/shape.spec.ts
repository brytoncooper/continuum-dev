import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';

type SourceFileMap = Record<string, ts.SourceFile>;

const SOURCES: SourceFileMap = {
  'index.ts': loadSource('../index.ts'),
  'actions.ts': loadSource('./actions.ts'),
  'constants.ts': loadSource('./constants.ts'),
  'interactions.ts': loadSource('./interactions.ts'),
  'proposals.ts': loadSource('./proposals.ts'),
  'reconciliation.ts': loadSource('./reconciliation.ts'),
  'restore-reviews.ts': loadSource('./restore-reviews.ts'),
  'streams.ts': loadSource('./streams.ts'),
  'transforms.ts': loadSource('./transforms.ts'),
  'view-patch.ts': loadSource('./view-patch.ts'),
};

function loadSource(relativePath: string): ts.SourceFile {
  const fileUrl = new URL(relativePath, import.meta.url);
  const filePath = fileURLToPath(fileUrl);
  const text = readFileSync(filePath, 'utf8');
  return ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
      true
  );
}

function getExportedDeclarationNames(source: ts.SourceFile): string[] {
  const names: string[] = [];

  for (const statement of source.statements) {
    if (!hasExportModifier(statement)) {
      continue;
    }

    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      if (statement.name) {
        names.push(statement.name.text);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.push(declaration.name.text);
        }
      }
    }
  }

  return names.sort();
}

function getExportModuleSpecifiers(source: ts.SourceFile): string[] {
  return source.statements
    .filter(ts.isExportDeclaration)
    .map((statement) => {
      if (
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        throw new Error(
          'Expected all protocol entrypoint exports to have module specifiers.'
        );
      }
      return statement.moduleSpecifier.text;
    })
    .sort();
}

function getInterfaceDeclaration(
  source: ts.SourceFile,
  interfaceName: string
): ts.InterfaceDeclaration {
  const declaration = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) &&
      statement.name.text === interfaceName
  );

  if (!declaration) {
    throw new Error(
      `Could not find interface ${interfaceName} in ${source.fileName}.`
    );
  }

  return declaration;
}

function getTypeAliasDeclaration(
  source: ts.SourceFile,
  typeName: string
): ts.TypeAliasDeclaration {
  const declaration = source.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName
  );

  if (!declaration) {
    throw new Error(
      `Could not find type alias ${typeName} in ${source.fileName}.`
    );
  }

  return declaration;
}

function getMemberName(name: ts.PropertyName | ts.DeclarationName): string {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }

  throw new Error(`Unsupported member name kind ${ts.SyntaxKind[name.kind]}.`);
}

function getInterfaceMembers(
  source: ts.SourceFile,
  interfaceName: string
): string[] {
  const declaration = getInterfaceDeclaration(source, interfaceName);

  return declaration.members
    .map((member) => {
      if (
        (ts.isPropertySignature(member) || ts.isMethodSignature(member)) &&
        member.name
      ) {
        const name = getMemberName(member.name);
        if (ts.isMethodSignature(member)) {
          return `${name}()`;
        }
        return member.questionToken ? `${name}?` : name;
      }

      throw new Error(
        `Unsupported member kind ${
          ts.SyntaxKind[member.kind]
        } in ${interfaceName}.`
      );
    })
    .sort();
}

function collectStringLiteralValues(
  source: ts.SourceFile,
  typeNode: ts.TypeNode,
  seenAliases = new Set<string>()
): string[] {
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectStringLiteralValues(source, typeNode.type, seenAliases);
  }

  if (ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal)) {
    return [typeNode.literal.text];
  }

  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.flatMap((member) =>
      collectStringLiteralValues(source, member, seenAliases)
    );
  }

  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const aliasName = typeNode.typeName.text;
    if (seenAliases.has(aliasName)) {
      return [];
    }

    seenAliases.add(aliasName);
    return collectStringLiteralValues(
      source,
      getTypeAliasDeclaration(source, aliasName).type,
      seenAliases
    );
  }

  return [];
}

function getStringLiteralUnionValues(
  source: ts.SourceFile,
  typeName: string
): string[] {
  return uniqueSorted(
    collectStringLiteralValues(
      source,
      getTypeAliasDeclaration(source, typeName).type
    )
  );
}

function collectDiscriminantValues(
  source: ts.SourceFile,
  typeNode: ts.TypeNode,
  propertyName: string,
  seenAliases = new Set<string>()
): string[] {
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectDiscriminantValues(
      source,
      typeNode.type,
      propertyName,
      seenAliases
    );
  }

  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.flatMap((member) =>
      collectDiscriminantValues(source, member, propertyName, seenAliases)
    );
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    const property = typeNode.members.find(
      (member): member is ts.PropertySignature =>
        ts.isPropertySignature(member) &&
        !!member.name &&
        getMemberName(member.name) === propertyName
    );

    if (!property?.type) {
      throw new Error(
        `Expected discriminant property ${propertyName} in ${source.fileName}.`
      );
    }

    return collectStringLiteralValues(source, property.type, seenAliases);
  }

  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const aliasName = typeNode.typeName.text;
    if (seenAliases.has(aliasName)) {
      return [];
    }

    seenAliases.add(aliasName);
    return collectDiscriminantValues(
      source,
      getTypeAliasDeclaration(source, aliasName).type,
      propertyName,
      seenAliases
    );
  }

  throw new Error(
    `Unsupported discriminated union member ${
      ts.SyntaxKind[typeNode.kind]
    } in ${source.fileName}.`
  );
}

function getDiscriminantUnionValues(
  source: ts.SourceFile,
  typeName: string,
  propertyName: string
): string[] {
  return uniqueSorted(
    collectDiscriminantValues(
      source,
      getTypeAliasDeclaration(source, typeName).type,
      propertyName
    )
  );
}

function getInterfacePropertyStringLiteralValues(
  source: ts.SourceFile,
  interfaceName: string,
  propertyName: string
): string[] {
  const declaration = getInterfaceDeclaration(source, interfaceName);
  const property = declaration.members.find(
    (member): member is ts.PropertySignature =>
      ts.isPropertySignature(member) &&
      !!member.name &&
      getMemberName(member.name) === propertyName
  );

  if (!property?.type) {
    throw new Error(
      `Could not find property ${propertyName} on interface ${interfaceName}.`
    );
  }

  return uniqueSorted(collectStringLiteralValues(source, property.type));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

describe('protocol public shape', () => {
  it('re-exports the expected public modules from the entrypoint', () => {
    expect(getExportModuleSpecifiers(SOURCES['index.ts'])).toEqual([
      './lib/actions.js',
      './lib/constants.js',
      './lib/interactions.js',
      './lib/proposals.js',
      './lib/reconciliation.js',
      './lib/restore-reviews.js',
      './lib/streams.js',
      './lib/transforms.js',
      './lib/view-patch.js',
    ]);
  });

  it('keeps each protocol module export list stable', () => {
    expect(
      Object.fromEntries(
        Object.entries({
          'actions.ts': SOURCES['actions.ts'],
          'constants.ts': SOURCES['constants.ts'],
          'interactions.ts': SOURCES['interactions.ts'],
          'proposals.ts': SOURCES['proposals.ts'],
          'reconciliation.ts': SOURCES['reconciliation.ts'],
          'restore-reviews.ts': SOURCES['restore-reviews.ts'],
          'streams.ts': SOURCES['streams.ts'],
          'transforms.ts': SOURCES['transforms.ts'],
          'view-patch.ts': SOURCES['view-patch.ts'],
        }).map(([fileName, source]) => [
          fileName,
          getExportedDeclarationNames(source),
        ])
      )
    ).toEqual({
      'actions.ts': [
        'ActionContext',
        'ActionHandler',
        'ActionRegistration',
        'ActionResult',
        'ActionSessionRef',
      ],
      'constants.ts': [
        'DATA_RESOLUTIONS',
        'DataResolution',
        'INTENT_STATUS',
        'INTERACTION_TYPES',
        'ISSUE_CODES',
        'ISSUE_SEVERITY',
        'IntentStatus',
        'InteractionType',
        'IssueCode',
        'IssueSeverity',
        'VIEW_DIFFS',
        'ViewDiff',
        'isInteractionType',
      ],
      'interactions.ts': ['Checkpoint', 'Interaction', 'PendingIntent'],
      'proposals.ts': ['ProposedValue'],
      'reconciliation.ts': [
        'ReconciliationIssue',
        'ReconciliationResolution',
        'ReconciliationResult',
        'StateDiff',
      ],
      'restore-reviews.ts': [
        'DetachedRestoreApproval',
        'DetachedRestoreReview',
        'DetachedRestoreReviewCandidate',
        'DetachedRestoreScope',
      ],
      'streams.ts': [
        'ContinuumViewStreamPart',
        'SessionStream',
        'SessionStreamDiagnostics',
        'SessionStreamMode',
        'SessionStreamPart',
        'SessionStreamResult',
        'SessionStreamStartOptions',
        'SessionStreamStatus',
        'SessionStreamStatusLevel',
        'SessionViewApplyOptions',
      ],
      'transforms.ts': [
        'CONTINUUM_TRANSFORM_STRATEGIES',
        'ContinuumCarryTransformOperation',
        'ContinuumDetachTransformOperation',
        'ContinuumDropTransformOperation',
        'ContinuumMergeTransformOperation',
        'ContinuumSplitTransformOperation',
        'ContinuumTransformOperation',
        'ContinuumTransformPlan',
        'ContinuumTransformStrategyId',
      ],
      'view-patch.ts': [
        'ContinuumViewPatch',
        'ContinuumViewPatchOperation',
        'ContinuumViewPatchPosition',
      ],
    });
  });

  it('keeps the public interface keys stable', () => {
    expect(
      Object.fromEntries([
        [
          'ActionRegistration',
          getInterfaceMembers(SOURCES['actions.ts'], 'ActionRegistration'),
        ],
        [
          'ActionResult',
          getInterfaceMembers(SOURCES['actions.ts'], 'ActionResult'),
        ],
        [
          'ActionSessionRef',
          getInterfaceMembers(SOURCES['actions.ts'], 'ActionSessionRef'),
        ],
        [
          'ActionContext',
          getInterfaceMembers(SOURCES['actions.ts'], 'ActionContext'),
        ],
        [
          'Interaction',
          getInterfaceMembers(SOURCES['interactions.ts'], 'Interaction'),
        ],
        [
          'PendingIntent',
          getInterfaceMembers(SOURCES['interactions.ts'], 'PendingIntent'),
        ],
        [
          'Checkpoint',
          getInterfaceMembers(SOURCES['interactions.ts'], 'Checkpoint'),
        ],
        [
          'ProposedValue',
          getInterfaceMembers(SOURCES['proposals.ts'], 'ProposedValue'),
        ],
        [
          'ReconciliationResult',
          getInterfaceMembers(
            SOURCES['reconciliation.ts'],
            'ReconciliationResult'
          ),
        ],
        [
          'StateDiff',
          getInterfaceMembers(SOURCES['reconciliation.ts'], 'StateDiff'),
        ],
        [
          'ReconciliationResolution',
          getInterfaceMembers(
            SOURCES['reconciliation.ts'],
            'ReconciliationResolution'
          ),
        ],
        [
          'ReconciliationIssue',
          getInterfaceMembers(
            SOURCES['reconciliation.ts'],
            'ReconciliationIssue'
          ),
        ],
        [
          'DetachedRestoreReviewCandidate',
          getInterfaceMembers(
            SOURCES['restore-reviews.ts'],
            'DetachedRestoreReviewCandidate'
          ),
        ],
        [
          'DetachedRestoreApproval',
          getInterfaceMembers(
            SOURCES['restore-reviews.ts'],
            'DetachedRestoreApproval'
          ),
        ],
        [
          'DetachedRestoreReview',
          getInterfaceMembers(
            SOURCES['restore-reviews.ts'],
            'DetachedRestoreReview'
          ),
        ],
        [
          'SessionViewApplyOptions',
          getInterfaceMembers(SOURCES['streams.ts'], 'SessionViewApplyOptions'),
        ],
        [
          'ContinuumTransformPlan',
          getInterfaceMembers(
            SOURCES['transforms.ts'],
            'ContinuumTransformPlan'
          ),
        ],
        [
          'SessionStreamStartOptions',
          getInterfaceMembers(
            SOURCES['streams.ts'],
            'SessionStreamStartOptions'
          ),
        ],
        [
          'SessionStream',
          getInterfaceMembers(SOURCES['streams.ts'], 'SessionStream'),
        ],
        [
          'SessionStreamResult',
          getInterfaceMembers(SOURCES['streams.ts'], 'SessionStreamResult'),
        ],
        [
          'SessionStreamDiagnostics',
          getInterfaceMembers(
            SOURCES['streams.ts'],
            'SessionStreamDiagnostics'
          ),
        ],
        [
          'ContinuumViewPatchPosition',
          getInterfaceMembers(
            SOURCES['view-patch.ts'],
            'ContinuumViewPatchPosition'
          ),
        ],
        [
          'ContinuumViewPatch',
          getInterfaceMembers(SOURCES['view-patch.ts'], 'ContinuumViewPatch'),
        ],
      ])
    ).toEqual({
      ActionContext: ['intentId', 'nodeId', 'session', 'snapshot'],
      ActionRegistration: ['description?', 'icon?', 'label'],
      ActionResult: ['data?', 'error?', 'success'],
      ActionSessionRef: [
        'getSnapshot()',
        'proposeValue()',
        'pushView()',
        'updateState()',
      ],
      Checkpoint: [
        'checkpointId',
        'eventIndex',
        'sessionId',
        'snapshot',
        'timestamp',
        'trigger',
      ],
      ContinuumViewPatch: ['operations', 'version?', 'viewId?'],
      ContinuumViewPatchPosition: ['afterId?', 'beforeId?', 'index?'],
      DetachedRestoreApproval: [
        'approvedAt',
        'detachedKey',
        'detachedValue',
        'scope',
        'targetKey?',
        'targetNodeId',
        'targetSemanticKey?',
        'targetViewId?',
      ],
      DetachedRestoreReview: [
        'approvedTarget?',
        'candidates',
        'detachedKey',
        'detachedValue',
        'reviewId',
        'scope',
        'status',
      ],
      DetachedRestoreReviewCandidate: [
        'candidateId',
        'detachedKey',
        'reviewId',
        'scope',
        'score',
        'targetKey?',
        'targetLabel?',
        'targetNodeId',
        'targetParentLabel?',
        'targetSemanticKey?',
      ],
      Interaction: [
        'interactionId',
        'nodeId',
        'payload',
        'sessionId',
        'timestamp',
        'type',
        'viewVersion',
      ],
      PendingIntent: [
        'intentId',
        'intentName',
        'nodeId',
        'payload',
        'queuedAt',
        'status',
        'viewVersion',
      ],
      ProposedValue: [
        'currentValue',
        'nodeId',
        'proposedAt',
        'proposedValue',
        'source?',
      ],
      ReconciliationIssue: ['code', 'message', 'nodeId?', 'severity'],
      ReconciliationResolution: [
        'matchedBy',
        'newType',
        'nodeId',
        'priorId',
        'priorType',
        'priorValue',
        'reconciledValue',
        'resolution',
      ],
      ReconciliationResult: [
        'diffs',
        'issues',
        'reconciledState',
        'resolutions',
      ],
      ContinuumTransformPlan: ['operations'],
      SessionStream: [
        'affectedNodeIds',
        'baseViewVersion',
        'latestStatus?',
        'mode',
        'nodeStatuses',
        'partCount',
        'previewData',
        'previewView',
        'source?',
        'startedAt',
        'status',
        'streamId',
        'targetViewId',
        'updatedAt',
        'viewVersion?',
      ],
      SessionStreamDiagnostics: ['diffs', 'issues', 'resolutions'],
      SessionStreamResult: ['reason?', 'status', 'streamId'],
      SessionStreamStartOptions: [
        'baseViewVersion?',
        'initialView?',
        'mode?',
        'source?',
        'streamId?',
        'supersede?',
        'targetViewId',
      ],
      SessionViewApplyOptions: ['transformPlan?', 'transient?'],
      StateDiff: ['newValue?', 'nodeId', 'oldValue?', 'reason?', 'type'],
    });
  });

  it('keeps discriminators and literal unions stable for protocol payloads', () => {
    expect({
      checkpointTrigger: getInterfacePropertyStringLiteralValues(
        SOURCES['interactions.ts'],
        'Checkpoint',
        'trigger'
      ),
      continuumViewPatchOperation: getDiscriminantUnionValues(
        SOURCES['view-patch.ts'],
        'ContinuumViewPatchOperation',
        'op'
      ),
      continuumViewStreamPart: getDiscriminantUnionValues(
        SOURCES['streams.ts'],
        'ContinuumViewStreamPart',
        'kind'
      ),
      detachedRestoreReviewStatus: getInterfacePropertyStringLiteralValues(
        SOURCES['restore-reviews.ts'],
        'DetachedRestoreReview',
        'status'
      ),
      detachedRestoreScope: getDiscriminantUnionValues(
        SOURCES['restore-reviews.ts'],
        'DetachedRestoreScope',
        'kind'
      ),
      reconciliationMatchSources: getInterfacePropertyStringLiteralValues(
        SOURCES['reconciliation.ts'],
        'ReconciliationResolution',
        'matchedBy'
      ),
      sessionStreamMode: getStringLiteralUnionValues(
        SOURCES['streams.ts'],
        'SessionStreamMode'
      ),
      continuumTransformOperation: getDiscriminantUnionValues(
        SOURCES['transforms.ts'],
        'ContinuumTransformOperation',
        'kind'
      ),
      continuumTransformStrategyId: getStringLiteralUnionValues(
        SOURCES['transforms.ts'],
        'ContinuumTransformStrategyId'
      ),
      sessionStreamPart: getDiscriminantUnionValues(
        SOURCES['streams.ts'],
        'SessionStreamPart',
        'kind'
      ),
      sessionStreamStatus: getStringLiteralUnionValues(
        SOURCES['streams.ts'],
        'SessionStreamStatus'
      ),
      sessionStreamStatusLevel: getStringLiteralUnionValues(
        SOURCES['streams.ts'],
        'SessionStreamStatusLevel'
      ),
    }).toEqual({
      checkpointTrigger: ['auto', 'manual'],
      continuumViewPatchOperation: [
        'insert-node',
        'move-node',
        'remove-node',
        'replace-node',
        'wrap-nodes',
      ],
      continuumViewStreamPart: [
        'append-content',
        'insert-node',
        'move-node',
        'patch',
        'remove-node',
        'replace-node',
        'view',
        'wrap-nodes',
      ],
      detachedRestoreReviewStatus: ['approved', 'candidates', 'waiting'],
      detachedRestoreScope: ['draft', 'live'],
      reconciliationMatchSources: ['id', 'key', 'semanticKey'],
      continuumTransformOperation: [
        'carry',
        'detach',
        'drop',
        'merge',
        'split',
      ],
      continuumTransformStrategyId: ['concat-space', 'identity', 'split-space'],
      sessionStreamMode: ['draft', 'foreground'],
      sessionStreamPart: [
        'append-content',
        'insert-node',
        'move-node',
        'node-status',
        'patch',
        'remove-node',
        'replace-node',
        'state',
        'status',
        'view',
        'wrap-nodes',
      ],
      sessionStreamStatus: [
        'aborted',
        'committed',
        'open',
        'stale',
        'superseded',
      ],
      sessionStreamStatusLevel: ['error', 'info', 'success', 'warning'],
    });
  });
});
