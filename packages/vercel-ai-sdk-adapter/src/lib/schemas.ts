import { z } from 'zod';

const streamModeSchema = z.enum(['foreground', 'draft']);

const nodeValueSchema = z
  .object({
    value: z.unknown(),
    suggestion: z.unknown().optional(),
    isDirty: z.boolean().optional(),
    protection: z
      .object({
        owner: z.enum(['ai', 'user']),
        stage: z.enum(['flexible', 'reviewed', 'locked', 'submitted']),
      })
      .optional(),
    isValid: z.boolean().optional(),
  })
  .passthrough();

const viewNodeSchema = z
  .object({
    id: z.string(),
    type: z.string(),
  })
  .passthrough();

const viewDefinitionSchema = z
  .object({
    viewId: z.string(),
    version: z.string(),
    nodes: z.array(viewNodeSchema),
  })
  .passthrough();

const patchSchema = z
  .object({
    viewId: z.string(),
    version: z.string(),
    operations: z.array(z.object({}).passthrough()),
  })
  .passthrough();

const nodeSchema = z
  .object({
    id: z.string(),
    type: z.string(),
  })
  .passthrough();

const positionSchema = z.object({}).passthrough();

export const continuumVercelAiSdkMessageMetadataSchema = z
  .object({
    label: z.string().optional(),
  })
  .passthrough();

export const continuumVercelAiSdkDataPartSchemas = {
  'continuum-view': z
    .object({
      view: viewDefinitionSchema,
      transformPlan: z
        .object({
          operations: z.array(z.object({}).passthrough()),
        })
        .passthrough()
        .optional(),
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-patch': z
    .object({
      patch: patchSchema,
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-insert-node': z
    .object({
      node: nodeSchema,
      parentId: z.string().nullable().optional(),
      position: positionSchema.optional(),
      targetViewId: z.string().optional(),
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-replace-node': z
    .object({
      nodeId: z.string(),
      node: nodeSchema,
      targetViewId: z.string().optional(),
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-remove-node': z
    .object({
      nodeId: z.string(),
      targetViewId: z.string().optional(),
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-append-content': z
    .object({
      nodeId: z.string(),
      text: z.string(),
      targetViewId: z.string().optional(),
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-state': z
    .object({
      nodeId: z.string(),
      value: nodeValueSchema,
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-reset': z
    .object({
      reason: z.string().optional(),
    })
    .passthrough(),
  'continuum-status': z
    .object({
      status: z.string(),
      level: z.enum(['info', 'success', 'warning', 'error']).optional(),
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
  'continuum-node-status': z
    .object({
      nodeId: z.string(),
      status: z.string(),
      level: z.enum(['info', 'success', 'warning', 'error']).optional(),
      subtree: z.boolean().optional(),
      targetViewId: z.string().optional(),
      streamMode: streamModeSchema.optional(),
    })
    .passthrough(),
} as const;
