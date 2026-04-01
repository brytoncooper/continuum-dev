import { describe, expect, it } from 'vitest';
import type { DataSnapshot, DetachedValue, ViewNode } from '@continuum-dev/contract';
import { findRestoreCandidates } from './index.js';

describe('findRestoreCandidates', () => {
  it('excludes dirty and reviewed fields from restore targets', () => {
    const nodes: ViewNode[] = [
      {
        id: 'profile',
        type: 'group',
        children: [
          {
            id: 'dirty_email',
            type: 'field',
            dataType: 'string',
            label: 'Email',
          },
          {
            id: 'reviewed_email',
            type: 'field',
            dataType: 'string',
            label: 'Email',
          },
          {
            id: 'empty_email',
            type: 'field',
            dataType: 'string',
            label: 'Email',
          },
        ],
      },
    ];

    const data: DataSnapshot = {
      values: {
        'profile/dirty_email': {
          value: 'person@example.com',
          isDirty: true,
        },
        'profile/reviewed_email': {
          value: 'accepted@example.com',
          protection: {
            owner: 'ai',
            stage: 'reviewed',
          },
        },
      },
      lineage: {
        timestamp: 1,
        sessionId: 'test-session',
      },
    };

    const detachedValue: DetachedValue = {
      value: 'restored@example.com',
      previousNodeType: 'field',
      previousLabel: 'Email',
      detachedAt: 1,
      reason: 'node-removed',
    };

    expect(findRestoreCandidates(nodes, data, detachedValue)).toEqual([
      expect.objectContaining({
        targetNodeId: 'profile/empty_email',
      }),
    ]);
  });
});
